import "../web/design-system/tokens.css";
import "../web/styles.css";
import "../web/design-system/design-system.css";
import "../web/design-system/prototype-theme.css";
import "../web/design-system/components.js";

/** @type { import('@storybook/html-vite').Preview } */
const preview = {
  parameters: {
    a11y: {
      test: "todo",
    },
    backgrounds: {
      default: "GLL Canvas",
      values: [
        { name: "GLL Canvas", value: "#f5f3ed" },
        { name: "Paper", value: "#fffefa" },
        { name: "Forest", value: "#183d35" },
      ],
    },
    controls: {
      expanded: true,
    },
    layout: "padded",
    viewport: {
      options: {
        mobile: { name: "Mobile", styles: { width: "390px", height: "844px" } },
        tablet: { name: "Tablet", styles: { width: "768px", height: "1024px" } },
        desktop: { name: "Desktop", styles: { width: "1440px", height: "900px" } },
      },
    },
  },
};

export default preview;
