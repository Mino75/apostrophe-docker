<template>
  <div
    role="application"
    aria-label="Color picker"
    class="apos-color"
    :class="[
      disableAlpha ? 'apos-color--disable-alpha' : null,
      disableSpectrum ? 'apos-color--disable-spectrum' : null,
      disableFields ? 'apos-color--disable-fields' : null,
      !presetColors ? 'apos-color--disable-presets' : null
    ]"
  >
    <div
      v-if="!disableSpectrum"
      class="apos-color__saturation-wrap"
    >
      <Saturation
        :value="colors"
        @change="childChange"
      />
    </div>
    <div
      v-if="!(disableSpectrum && disableAlpha)"
      class="apos-color__controls"
    >
      <div class="apos-color__sliders">
        <div
          v-if="!disableSpectrum"
          class="apos-color__hue-wrap"
        >
          <Hue
            :value="colors"
            @change="childChange"
          />
        </div>
        <div
          v-if="!disableAlpha"
          class="apos-color__alpha-wrap"
        >
          <Alpha
            :value="colors"
            @change="childChange"
          />
        </div>
      </div>
      <div class="apos-color__color-wrap">
        <div
          :data-apos-active-color="activeColor"
          :aria-label="`Current color is ${activeColor}`"
          class="apos-color__active-color"
          :style="{ background: activeColor }"
        />
        <AposColorCheckerboard />
      </div>
    </div>
    <div
      v-if="!disableFields"
      class="apos-color__field"
    >
      <!-- rgba -->
      <div class="apos-color__field--double">
        <EditableContent
          label="hex"
          :value="hex"
          @change="inputChange"
        />
      </div>
      <div class="apos-color__field--single">
        <EditableContent
          label="r"
          :value="colors.rgba.r"
          @change="inputChange"
        />
      </div>
      <div class="apos-color__field--single">
        <EditableContent
          label="g"
          :value="colors.rgba.g"
          @change="inputChange"
        />
      </div>
      <div class="apos-color__field--single">
        <EditableContent
          label="b"
          :value="colors.rgba.b"
          @change="inputChange"
        />
      </div>
      <div
        v-if="!disableAlpha"
        class="apos-color__field--single"
      >
        <EditableContent
          label="a"
          :value="colors.a"
          :arrow-offset="0.01"
          :max="1"
          @change="inputChange"
        />
      </div>
    </div>
    <div
      v-if="presetColors"
      class="apos-color__presets"
      role="group"
      aria-label="A color preset, pick one to set as current color"
    >
      <template v-for="c in presetColors">
        <div
          v-if="!isTransparent(c)"
          :key="`!${c}`"
          class="apos-color__presets-color"
          :aria-label="`Color:${c}`"
          :style="{ background: formatCssValue(c) }"
          @click="handlePreset(c)"
        />
        <div
          v-else
          :key="c"
          :aria-label="`Color:${c}`"
          class="apos-color__presets-color"
          @click="handlePreset(c)"
        >
          <AposColorCheckerboard />
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import colorMixin from '../mixins/AposColorMixin';
import editableInput from '../lib/AposColorEditableInput.vue';
import saturation from '../lib/AposColorSaturation.vue';
import hue from '../lib/AposColorHue.vue';
import alpha from '../lib/AposColorAlpha.vue';

const defaultOptions = { ...apos.modules['@apostrophecms/color-field'].defaultOptions };

export default {
  name: 'AposColor',
  components: {
    Saturation: saturation,
    Hue: hue,
    Alpha: alpha,
    EditableContent: editableInput
  },
  mixins: [ colorMixin ],
  props: {
    options: {
      type: Object,
      default() {
        return defaultOptions;
      }
    }
  },
  computed: {
    defaultOptions() {
      return defaultOptions;
    },
    finalOptions() {
      let final = { ...this.options };

      // Handle BC `pickerOptions` sub object.
      // Modern API wins out over BC conflicts
      if (final.pickerOptions) {
        final = {
          ...final.pickerOptions,
          ...final
        };
        delete final.pickerOptions;
      }

      // Normalize disabling presetColors
      if (
        Array.isArray(final.presetColors) &&
        final.presetColors.length === 0
      ) {
        final.presetColors = false;
      }

      // If `true`, let defaults through
      if (final.presetColors === true) {
        delete final.presetColors;
      }

      return Object.assign({ ...this.defaultOptions }, final);
    },
    presetColors() {
      return this.finalOptions.presetColors;
    },
    disableAlpha() {
      return this.finalOptions.disableAlpha;
    },
    disableSpectrum() {
      return this.finalOptions.disableSpectrum;
    },
    disableFields() {
      return this.finalOptions.disableFields;
    },
    hex() {
      let hex;
      if (this.colors.a < 1) {
        hex = this.colors.hex8;
      } else {
        hex = this.colors.hex;
      }

      return hex.replace('#', '');
    },
    activeColor() {
      const { rgba } = this.colors;
      return `rgba(${[ rgba.r, rgba.g, rgba.b, rgba.a ].join(',')})`;
    }
  },
  methods: {
    formatCssValue(c) {
      let value = c;
      if (c.startsWith('--')) {
        value = `var(${value})`;
      }
      return value;
    },
    handlePreset(c) {
      this.colorChange(c);
    },
    childChange(data) {
      this.colorChange(data);
    },
    inputChange(data) {
      if (!data) {
        return;
      }

      if (data.hex) {
        this.isValidHex(data.hex) && this.colorChange({
          hex: data.hex,
          source: 'hex'
        });
      } else if (data.r || data.g || data.b || data.a) {
        this.colorChange({
          r: data.r || this.colors.rgba.r,
          g: data.g || this.colors.rgba.g,
          b: data.b || this.colors.rgba.b,
          a: data.a || this.colors.rgba.a,
          source: 'rgba'
        });
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-color {
  position: relative;
  box-sizing: initial;
  width: 200px;
  padding: $spacing-base $spacing-base 0;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 15%), 0 8px 16px rgb(0 0 0 / 15%);
}

.apos-color--disable-alpha.apos-color--disable-spectrum.apos-color--disable-fields {
  .apos-color__presets {
    border-top: none;
  }
}

.apos-color__saturation-wrap {
  position: relative;
  overflow: hidden;
  width: 100%;
  padding-bottom: 75%;
}

.apos-color__controls {
  display: flex;
}

.apos-color__sliders {
  flex: 1;
  padding: 4px 0;
}

.apos-color__sliders .apos-color__hue,
.apos-color__sliders .apos-color__alpha-gradient {
  border-radius: 2px;
}

.apos-color__hue-wrap {
  position: relative;
  height: $spacing-base;
}

.apos-color__alpha-wrap {
  position: relative;
  overflow: hidden;
  height: $spacing-base;
  margin-top: 4px;
}

.apos-color__color-wrap {
  position: relative;
  width: 24px;
  height: 24px;
  margin-top: 4px;
  margin-left: 4px;
  border-radius: 3px;
}

.apos-color__active-color {
  z-index: $z-index-default;
  position: absolute;
  inset: 0;
  border-radius: 2px;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 15%), inset 0 0 4px rgb(0 0 0 / 25%);
}

.apos-color__field {
  display: flex;
  padding-top: 4px;
}

.apos-color__field .apos-color__input {
  width: 90%;
  padding: 4px 0 3px 10%;
  border: none;
  box-shadow: inset 0 0 0 1px #ccc;
  font-size: var(--a-type-small);
}

.apos-color__field .apos-color__label {
  display: block;
  padding-top: 3px;
  padding-bottom: 4px;
  color: var(--a-text-primary);
  font-size: var(--a-type-smaller);
  text-align: center;
  text-transform: capitalize;
}

.apos-color__field--single {
  flex: 1;
  padding-left: 6px;
}

.apos-color__field--double {
  flex: 2;
}

.apos-color__presets {
  margin-right: -$spacing-base;
  margin-left: -$spacing-base;
  padding-top: $spacing-base;
  padding-left: $spacing-base;
  border-top: 1px solid #eee;
}

.apos-color__presets-color {
  position: relative;
  display: inline-block;
  overflow: hidden;
  width: 16px;
  height: 16px;
  margin: 0 $spacing-base $spacing-base 0;
  vertical-align: top;
  cursor: pointer;
  border-radius: 3px;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 15%);
}

.apos-color__presets-color {
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 15%);
  border-radius: 3px;
}

.apos-color--disable-alpha .apos-color__color-wrap {
  height: $spacing-base;
}

.apos-popover .apos-color {
  padding: 0;
  box-shadow: none;
}
</style>
