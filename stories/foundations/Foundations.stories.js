const catalog = () => window.GLLDesignSystem;
const frame = (content) => `<main class="ds-doc-section" style="max-width: 1200px">${content}</main>`;

export default {
  title: "Foundations",
  tags: ["autodocs"],
};

export const Colors = {
  render: () => {
    const { TOKENS } = catalog();
    return frame(`<div class="ds-section-heading"><h1>Cores</h1><p>Tokens semânticos oficiais do GLL.</p></div><div class="ds-color-grid">${TOKENS.colors.map(([name, variable, usage]) => `<article class="ds-color-card"><span style="--swatch: var(${variable})"></span><strong>${name}</strong><code>${variable}</code><small>${getComputedStyle(document.documentElement).getPropertyValue(variable).trim()}</small><p>${usage}</p></article>`).join("")}</div>`);
  },
};

export const Typography = {
  render: () => frame('<div class="ds-section-heading"><h1>Tipografia</h1><p>Inter, Segoe UI e Arial.</p></div><div class="ds-type-stack"><h1>Heading 1 · 32 px</h1><h2>Heading 2 · 24 px</h2><h3>Heading 3 · 20 px</h3><p>Body · 14 px / line-height 1.5</p><label>Label · 13 px / semibold</label><small>Caption · 12 px</small></div>'),
};

export const Spacing = {
  render: () => frame(`<div class="ds-section-heading"><h1>Espaçamento</h1><p>Escala base de 4 px.</p></div><div class="ds-scale-list">${catalog().TOKENS.spacing.map((name) => `<div class="ds-scale-row"><code>--space-${name}</code><span style="width: var(--space-${name})"></span><small>${getComputedStyle(document.documentElement).getPropertyValue(`--space-${name}`).trim()}</small></div>`).join("")}</div>`),
};

export const Radius = {
  render: () => frame(`<div class="ds-section-heading"><h1>Border radius</h1></div><div class="ds-sample-grid">${catalog().TOKENS.radius.map((name) => `<div class="ds-radius-sample" style="border-radius: var(--radius-${name})"><code>${name}</code></div>`).join("")}</div>`),
};

export const Shadows = {
  render: () => frame(`<div class="ds-section-heading"><h1>Sombras</h1></div><div class="ds-sample-grid">${catalog().TOKENS.shadows.map((name) => `<div class="ds-shadow-sample" style="box-shadow: var(--shadow-${name})"><code>shadow-${name}</code></div>`).join("")}</div>`),
};

export const Icons = {
  render: () => frame(`<div class="ds-section-heading"><h1>Ícones</h1><p>Glifos atualmente usados pela aplicação.</p></div><div class="ds-icon-grid">${Object.entries(catalog().ICONS).map(([name, glyph]) => `<div class="ds-icon-sample"><span aria-hidden="true">${glyph}</span><code>${name}</code></div>`).join("")}</div>`),
};
