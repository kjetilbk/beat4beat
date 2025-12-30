declare namespace NodeJS {
  interface ProcessEnv {
    CAST_APP_ID: string;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};
