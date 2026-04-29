// A utility / type-only file that should not be instrumented.

export const slugify = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export interface Foo {
  bar: string;
}
