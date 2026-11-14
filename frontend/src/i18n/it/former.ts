/**
 * Words the app wrote into saved data in earlier versions, before they were
 * reworded. Nothing shows them: they are how a description kept in a
 * browser from then is still known as one the app wrote, and so goes on
 * following the language of the interface (utils/templateText.ts).
 */
export const formerLinkTypeDescriptions: Readonly<Record<string, readonly string[]>> = {
  access: ['Porta di accesso a dispositivi finali'],
  trunk: ['Link trunk tra switch'],
  uplink: ['Uplink a core/internet'],
};
