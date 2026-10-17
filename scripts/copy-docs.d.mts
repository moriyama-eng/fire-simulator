export interface CopyDocsOptions {
  projectRoot?: string;
  docsRoot?: string;
  clientDist?: string;
  fsImpl?: any;
}

export function copyDocs(options?: CopyDocsOptions): Promise<void>;
