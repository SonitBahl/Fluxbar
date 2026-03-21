export function createInputController(deps) {
  return {
    bind() {
      if (!deps?.ui) {
        throw new Error("inputController requires ui dependency");
      }
    },
  };
}
