/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * A dónde se manda el formulario de empresas. Mientras no haya backend
   * queda sin definir y el formulario abre WhatsApp con el mensaje ya
   * escrito, que es el canal que la página ya ofrece.
   */
  readonly VITE_CONTACT_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
