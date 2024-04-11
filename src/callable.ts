export class Callable<Signature> extends Function {
  constructor(protected _call: Signature) {
    super('...args', 'return this._call(...args)');

    // eslint-disable-next-line no-constructor-return
    return this.bind(this);
  }
}
