export function createStreamRenderer(ui) {
  return {
    async render() {
      if (!ui) {
        throw new Error("streamRenderer requires ui dependency");
      }
    },
  };
}
