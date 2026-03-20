export interface ValidatedEnv {
  PORT: number;
}

export function validateEnv(config: Record<string, unknown>): ValidatedEnv {
  const port = config['PORT'];
  const portNum = port !== undefined ? Number(port) : NaN;
  if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) {
    throw new Error(
      'Invalid or missing PORT in .env. Must be a number between 1 and 65535.',
    );
  }
  return { PORT: portNum };
}
