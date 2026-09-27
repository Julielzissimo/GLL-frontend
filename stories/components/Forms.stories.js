const c = () => window.GLLDesignSystem.COMPONENTS;
const fieldFrame = (content) => `<div style="width:min(480px,100%);display:grid;gap:16px">${content}</div>`;

export default {
  title: "Components/Forms",
  tags: ["autodocs"],
};

export const InputDefault = { render: () => fieldFrame(c().formField({ id: "input-default", label: "Órgão comprador", placeholder: "Pesquisar órgão…" })) };
export const InputFilled = { render: () => fieldFrame(c().formField({ id: "input-filled", label: "Número do edital", value: "PE 014/2026" })) };
export const InputError = { render: () => fieldFrame(c().formField({ id: "input-error", label: "Número do edital", value: "14/2026", error: "Revise o número informado." })) };
export const InputDisabled = { render: () => fieldFrame(c().formField({ id: "input-disabled", label: "Organização", value: "LSMS Suprimentos", disabled: true })) };
export const Textarea = { render: () => fieldFrame(c().textarea({ id: "textarea", label: "Observações", helper: "Até 500 caracteres." })) };
export const Select = { render: () => fieldFrame(c().select({ id: "select", label: "Status", options: ["Em análise", "Aprovada", "Descartada"] })) };
export const Checkbox = { render: () => c().checkbox({ id: "checkbox", label: "Item ganho", checked: true }) };
export const Radio = { render: () => fieldFrame(`${c().radio({ id: "radio-1", name: "type", label: "Pregão eletrônico", checked: true })}${c().radio({ id: "radio-2", name: "type", label: "Concorrência" })}`) };
export const Switch = { render: () => c().switchControl({ id: "switch", label: "Notificações", checked: true }) };
