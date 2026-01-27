export const authState = {
  signedIn: false,
};

export function isSignedIn() {
  return authState.signedIn;
}
