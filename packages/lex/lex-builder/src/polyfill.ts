// Node <18.18, 19.x, <20.4 and 21.x do not have these symbols defined

// @ts-expect-error
Symbol.asyncDispose ??= Symbol.for('nodejs.asyncDispose')

// @ts-expect-error
Symbol.dispose ??= Symbol.for('nodejs.dispose')
