import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import AposEditorMixin from 'Modules/@apostrophecms/modal/mixins/AposEditorMixin';
import cuid from 'cuid';
import { klona } from 'klona';
import { get } from 'lodash';
import { detectDocChange } from 'Modules/@apostrophecms/schema/lib/detectChange';

export default {
  name: 'AposArrayEditor',
  mixins: [
    AposModifiedMixin,
    AposEditorMixin
  ],
  props: {
    items: {
      required: true,
      type: Array
    },
    meta: {
      type: Object,
      default: () => ({})
    },
    field: {
      required: true,
      type: Object
    },
    inputSchema: {
      type: Array,
      required: true
    },
    serverError: {
      type: Object,
      default: null
    },
    docId: {
      type: String,
      default: null
    }
  },
  emits: [ 'modal-result', 'safe-close' ],
  data() {
    // Automatically add `_id` to default items
    const items = this.items.map(item => ({
      ...item,
      _id: item._id || cuid()
    }));

    return {
      currentId: null,
      currentDoc: null,
      modal: {
        active: false,
        type: 'overlay',
        showModal: false
      },
      modalTitle: {
        key: 'apostrophe:editType',
        type: this.$t(this.field.label)
      },
      titleFieldChoices: null,
      // If we don't clone, then we're making
      // permanent modifications whether the user
      // clicks save or not
      next: klona(items),
      original: klona(items),
      triggerValidation: false,
      minError: false,
      maxError: false,
      cancelDescription: 'apostrophe:arrayCancelDescription'
    };
  },
  computed: {
    moduleOptions() {
      return window.apos.schema || {};
    },
    itemError() {
      return this.currentDoc && this.currentDoc.hasErrors;
    },
    valid() {
      return !(this.minError || this.maxError || this.itemError);
    },
    maxed() {
      return (this.field.max !== undefined) && (this.next.length >= this.field.max);
    },
    schema() {
      // For AposDocEditorMixin
      return (this.inputSchema || this.field.schema || [])
        .filter(field => apos.schema.components.fields[field.type]);
    },
    countLabel() {
      return this.$t('apostrophe:numberAdded', {
        count: this.next.length
      });
    },
    // Here in the array editor we use effectiveMin to factor in the
    // required property because there is no other good place to do that,
    // unlike the input field wrapper which has a separate visual
    // representation of "required".
    minLabel() {
      if (this.effectiveMin) {
        return this.$t('apostrophe:minUi', {
          number: this.effectiveMin
        });
      } else {
        return false;
      }
    },
    maxLabel() {
      if ((typeof this.field.max) === 'number') {
        return this.$t('apostrophe:maxUi', {
          number: this.field.max
        });
      } else {
        return false;
      }
    },
    effectiveMin() {
      if (this.field.min) {
        return this.field.min;
      } else if (this.field.required) {
        return 1;
      } else {
        return 0;
      }
    },
    currentDocServerErrors() {
      let serverErrors = null;
      ((this.serverError && this.serverError.data && this.serverError.data.errors) || []).forEach(error => {
        const [ _id, fieldName ] = error.path.split('.');
        if (_id === this.currentId) {
          serverErrors = serverErrors || {};
          serverErrors[fieldName] = error;
        }
      });
      return serverErrors;
    },
    currentDocMeta() {
      return this.meta[this.currentId]?.aposMeta || {};
    }
  },
  async mounted() {
    this.modal.active = true;
    await this.evaluateExternalConditions();
    if (this.next.length) {
      await this.select(this.next[0]._id);
    }
    if (this.serverError && this.serverError.data && this.serverError.data.errors) {
      const first = this.serverError.data.errors[0];
      const [ _id, name ] = first.path.split('.');
      await this.select(_id);
      const aposSchema = this.$refs.schema;
      await this.nextTick();
      aposSchema.scrollFieldIntoView(name);
    }
    this.titleFieldChoices = await this.getTitleFieldChoices();
  },
  methods: {
    async select(_id) {
      if (this.currentId === _id) {
        return;
      }
      if (await this.validate(true, false)) {
        // Force the array editor to totally reset to avoid in-schema
        // animations when switching (e.g., the relationship input).
        this.currentDocToCurrentItem();
        this.currentId = null;
        await this.nextTick();
        this.currentId = _id;
        this.currentDoc = {
          hasErrors: false,
          data: this.next.find(item => item._id === _id)
        };
        this.evaluateConditions();
        this.triggerValidation = false;
      }
    },
    update(items) {
      // Take care to use the same items in order to avoid
      // losing too much state inside draggable, otherwise
      // drags fail
      this.next = items.map(item => this.next.find(_item => item._id === _item._id));
      if (this.currentId) {
        if (!this.next.find(item => item._id === this.currentId)) {
          this.currentId = null;
          this.currentDoc = null;
        }
      }
      this.updateMinMax();
    },
    currentDocUpdate(currentDoc) {
      this.currentDoc = currentDoc;
      this.evaluateConditions();
    },
    async add() {
      if (await this.validate(true, false)) {
        const item = this.newInstance();
        item._id = cuid();
        this.next.push(item);
        await this.select(item._id);
        this.updateMinMax();
      }
    },
    updateMinMax() {
      let minError = false;
      let maxError = false;
      if (this.effectiveMin) {
        if (this.next.length < this.effectiveMin) {
          minError = true;
        }
      }
      if (this.field.max !== undefined) {
        if (this.next.length > this.field.max) {
          maxError = true;
        }
      }
      this.minError = minError;
      this.maxError = maxError;
    },
    async submit() {
      if (await this.validate(true, true)) {
        this.currentDocToCurrentItem();
        for (const item of this.next) {
          item.metaType = 'arrayItem';
          item.scopedArrayName = this.field.scopedArrayName;
        }
        this.$emit('modal-result', this.next);
        this.modal.showModal = false;
      }
    },
    currentDocToCurrentItem() {
      if (!this.currentId) {
        return;
      }
      const currentIndex = this.next.findIndex(item => item._id === this.currentId);
      this.next[currentIndex] = this.currentDoc.data;
    },
    getFieldValue(name) {
      return this.currentDoc.data[name];
    },
    isModified() {
      if (this.currentId) {
        const currentIndex = this.next.findIndex(item => item._id === this.currentId);
        if (detectDocChange(this.schema, this.next[currentIndex], this.currentDoc.data)) {
          return true;
        }
      }
      if (this.next.length !== this.original.length) {
        return true;
      }
      for (let i = 0; (i < this.next.length); i++) {
        if (this.next[i]._id !== this.original[i]._id) {
          return true;
        }
        if (detectDocChange(this.schema, this.next[i], this.original[i])) {
          return true;
        }
      }
      return false;
    },
    async validate(validateItem, validateLength) {
      if (validateItem) {
        this.triggerValidation = true;
      }
      await this.nextTick();
      if (validateLength) {
        this.updateMinMax();
      }
      if (
        (validateLength && (this.minError || this.maxError)) ||
        (validateItem && (this.currentDoc && this.currentDoc.hasErrors))
      ) {
        await apos.notify('apostrophe:resolveErrorsFirst', {
          type: 'warning',
          icon: 'alert-circle-icon',
          dismiss: true
        });
        return false;
      } else {
        return true;
      }
    },
    // Awaitable nextTick
    nextTick() {
      return new Promise((resolve, reject) => {
        this.$nextTick(() => {
          return resolve();
        });
      });
    },
    newInstance() {
      const instance = {};
      for (const field of this.schema) {
        if (field.def !== undefined) {
          instance[field.name] = klona(field.def);
        }
      }
      return instance;
    },
    label(item) {
      let candidate;
      if (this.field.titleField) {

        // Initial field value
        candidate = get(item, this.field.titleField);

        // If the titleField references a select input, use the
        // select label as the slat label, rather than the value.
        if (this.titleFieldChoices) {
          const choice = this.titleFieldChoices.find(choice => choice.value === candidate);
          if (choice && choice.label) {
            candidate = choice.label;
          }
        }

      } else if (this.schema.find(field => field.name === 'title') && (item.title !== undefined)) {
        candidate = item.title;
      }
      if ((candidate == null) || candidate === '') {
        for (let i = 0; (i < this.next.length); i++) {
          if (this.next[i]._id === item._id) {
            candidate = `#${i + 1}`;
            break;
          }
        }
      }
      return candidate;
    },
    withLabels(items) {
      const result = items.map(item => ({
        ...item,
        title: this.label(item)
      }));
      return result;
    },
    async getTitleFieldChoices() {
      // If the titleField references a select input, get it's choices
      // to use as labels for the slat UI

      let choices = null;
      const titleField = this.schema.find(field => field.name === this.field.titleField);

      // The titleField is a select
      if (titleField?.choices) {

        // Choices are provided by a method
        if (typeof titleField.choices === 'string') {
          const action = `${this.moduleOptions.action}/choices`;
          try {
            const result = await apos.http.get(
              action,
              {
                qs: {
                  fieldId: titleField._id
                }
              }
            );
            if (result && result.choices) {
              choices = result.choices;
            }
          } catch (e) {
            console.error(this.$t('apostrophe:errorFetchingTitleFieldChoicesByMethod', { name: titleField.name }));
          }

        // Choices are a normal, hardcoded array
        } else if (Array.isArray(titleField.choices)) {
          choices = titleField.choices;
        }
      }
      return choices;
    },
    emitSafeClose() {
      this.$emit('safe-close');
    }
  }
};
