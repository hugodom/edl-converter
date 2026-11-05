declare module 'mammoth/mammoth.browser.js' {
  interface MammothResult {
    value: string;
    messages: unknown[];
  }
  const mammoth: {
    extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<MammothResult>;
  };
  export default mammoth;
}
