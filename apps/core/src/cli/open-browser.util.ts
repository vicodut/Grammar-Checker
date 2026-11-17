/** The command that opens a URL in the default browser, or null when this system has none. */
export const browserOpenCommand = (platform: NodeJS.Platform, url: string): string[] | null => {
  if (platform === "darwin") return ["open", url];
  if (platform === "linux") return ["xdg-open", url];
  return null;
};
