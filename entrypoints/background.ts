export default defineBackground(() => {
  console.log('Guard LLM background ready.', { id: browser.runtime.id });
});
