declare global {
  interface Reflect {
    defineMetadata?(
      metadataKey: unknown,
      metadataValue: unknown,
      target: object,
      propertyKey?: string | symbol,
    ): void;
    getOwnMetadata?(
      metadataKey: unknown,
      target: object,
      propertyKey?: string | symbol,
    ): unknown;
    getMetadata?(
      metadataKey: unknown,
      target: object,
      propertyKey?: string | symbol,
    ): unknown;
    hasOwnMetadata?(
      metadataKey: unknown,
      target: object,
      propertyKey?: string | symbol,
    ): boolean;
    hasMetadata?(
      metadataKey: unknown,
      target: object,
      propertyKey?: string | symbol,
    ): boolean;
    metadata?(
      metadataKey: unknown,
      metadataValue: unknown,
    ): (target: object, propertyKey?: string | symbol) => void;
  }
}

export {};
