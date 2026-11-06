/// <reference types="vite/client" />

declare module 'dompurify' {
  const DOMPurify: {
    sanitize: (dirty: string, options?: any) => string;
  };
  export default DOMPurify;
}

declare global {
  interface Window {
    tinymce?: any;
  }
}
