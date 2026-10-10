const components = () => window.GLLDesignSystem.COMPONENTS;

export default {
  title: "Components/IconButton",
  tags: ["autodocs"],
  render: (args) => components().iconButton(args),
  argTypes: {
    variant: { control: "select", options: ["default", "danger"] },
    icon: { control: "select", options: ["settings", "close"] },
  },
  args: { label: "Configurações", icon: "settings", variant: "default", disabled: false },
};

export const Default = {};
export const DangerClose = { args: { label: "Fechar modal", icon: "close", variant: "danger" } };
export const Disabled = { args: { disabled: true } };
