export default {
  title: "Components/Tooltip",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Padrão visual dos tooltips CSS do GLL. O fundo é centralizado no token --gll-tooltip-background e aplicado a superfícies data-tooltip.",
      },
    },
  },
};

export const TruncatedDescription = {
  name: "Descrição truncada",
  render: () => '<div style="max-width: 440px; padding: 32px 0;">' +
    '<div class="declaration-pick-preview-wrap has-tooltip" data-tooltip="Descrição completa exibida no tooltip customizado do GLL." tabindex="0">' +
    '<span class="declaration-pick-preview">Descrição de exemplo para demonstrar o tooltip customizado de uma declaração selecionada.</span>' +
    '</div>' +
    '</div>',
};
