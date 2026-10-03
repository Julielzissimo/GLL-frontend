const avatarPhoto = "https://flowbite.com/docs/images/people/profile-picture-5.jpg";

export default {
  title: "Patterns/Creator Attribution",
  tags: ["autodocs"],
};

export const WithProfilePhoto = {
  render: () => `
    <span class="creator-tag">
      <span class="creator-avatar" aria-hidden="true"><img src="${avatarPhoto}" alt="" width="42" height="42" /></span>
      <span class="creator-tag-copy"><span>Criado por</span><strong>Jese Leos</strong></span>
    </span>
  `,
};

export const InitialsFallback = {
  render: () => `
    <span class="creator-tag">
      <span class="creator-avatar" aria-hidden="true">JL</span>
      <span class="creator-tag-copy"><span>Criado por</span><strong>Jese Leos</strong></span>
    </span>
  `,
};

export const CompactInTable = {
  render: () => `
    <div style="max-width: 420px; padding: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface);">
      <span class="creator-tag compact">
        <span class="creator-avatar" aria-hidden="true">JL</span>
        <span class="creator-tag-copy"><span>Criado por</span><strong>Jese Leos</strong></span>
      </span>
    </div>
  `,
};
