// Augment the existing NodeJS namespace interface merging
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      API_KEY: string;
      [key: string]: string | undefined;
    }
  }
}

export {};