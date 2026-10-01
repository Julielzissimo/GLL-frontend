const components = () => window.GLLDesignSystem.COMPONENTS;

export default {
  title: "Components/Button",
  tags: ["autodocs"],
  render: (args) => components().button(args),
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "ghost", "danger"] },
  },
  args: { label: "Salvar", variant: "primary", disabled: false, loading: false, icon: "" },
};

export const Primary = {};
export const Secondary = { args: { variant: "secondary" } };
export const Ghost = { args: { variant: "ghost" } };
export const Danger = { args: { label: "Excluir", variant: "danger" } };
export const Disabled = { args: { disabled: true } };
export const Loading = { args: { loading: true } };
export const WithIcon = { args: { label: "Nova licitação", icon: "add" } };
