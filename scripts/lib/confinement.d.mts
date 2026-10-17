export const MIME_MAP: Record<string, string>;

export function resolveAndValidateSegments(cleanTarget: string, denyInternal?: boolean): string[];

export interface VerifyConfinedPathOptions {
  pathImpl?: any;
  fsImpl?: any;
  refuseSymlinks?: boolean;
  denyInternal?: boolean;
  skipRealpath?: boolean;
}

export function verifyConfinedPath(
  rootPath: string,
  targetPath: string,
  options?: VerifyConfinedPathOptions
): string;

export function sanitizeSvgContent(rawSvg: string): string;
