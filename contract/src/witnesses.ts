export type TrustCartPrivateState = {
  readonly secretKey: Uint8Array;
};

export const createTrustCartPrivateState = (secretKey: Uint8Array): TrustCartPrivateState => ({
  secretKey,
});

export const createWitnesses = () => ({
  localSecretKey: ({ privateState }: { privateState: TrustCartPrivateState }): [TrustCartPrivateState, Uint8Array] =>
    [privateState, privateState.secretKey],
});
