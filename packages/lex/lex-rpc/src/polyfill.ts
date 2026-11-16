// Node <18.18, 19.x, <20.4 and 21.x, and some browsers, do not have this
// symbol defined

// @ts-expect-error
Symbol.asyncDispose ??= Symbol.for('nodejs.asyncDispose')
