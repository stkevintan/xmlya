export type PromiseOrNot<T> = T | Promise<T>;

// export function pipe<T1, T2, T3>(X1: Promise<T1>, X2: (x: T1) => Promise<T2>, X3: (x: T2) => Promise<T3>): Promise<T3> {
//     return X1.then(x1 => X2(x1)).then(x2 => X3(x2));
// }