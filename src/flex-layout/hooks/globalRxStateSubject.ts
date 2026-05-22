//globalRxStateSubject.ts
"use client";
import "client-only";
import { useEffect, useState } from "react";
import { BehaviorSubject } from "rxjs";

/**
 * Generic RxJS-backed state primitive that feels like useState, but is app-wide.
 *
 * Usage:
 * export const [setCount, getCount, useCount, count$] = createRxState<number>(0);
 * setCount(1);
 * setCount(prev => prev + 1);
 * const v = getCount();
 * const valueInReact = useCount();
 */
// ---- Global registry (singleton across modules/HMR) ----
const g: any = globalThis as any;
g.__rxRegistry ??= new Map<string, any>();
const __globalRxRegistry: Map<string, any> = g.__rxRegistry;
// Object.assign(window as any, { __rxRegistry: __globalRxRegistry });

// Utility types for the named API
export type Updater<T> = T | ((prev: T) => T);
export type NamedSet<N extends string, T> = {
	[K in `set${Capitalize<N>}`]: (u: Updater<T>) => void;
};
export type NamedGet<N extends string, T> = {
	[K in `get${Capitalize<N>}`]: () => T;
};
export type NamedUse<N extends string, T> = {
	[K in `use${Capitalize<N>}`]: () => T;
};
export type NamedSubject<N extends string, T> = {
	[K in `${N}Subject`]: BehaviorSubject<T>;
};

// Internal entry kept in the registry
interface RxEntry<T> {
	subject: BehaviorSubject<T>;
	set: (u: Updater<T>) => void;
	get: () => T;
	useValue: () => T;
}

function makeEntry<T>(subject: BehaviorSubject<T>): RxEntry<T> {
	const set = (u: Updater<T>) => {
		const prev = subject.getValue();
		const next = typeof u === "function" ? (u as (p: T) => T)(prev) : u;
		subject.next(next);
	};
	const get = () => subject.getValue();
	const useValue = () => {
		const [v, setV] = useState<T>(get());
		useEffect(() => {
			const sub = subject.subscribe(setV);
			return () => sub.unsubscribe();
		}, []);
		return v;
	};
	return { subject, set, get, useValue };
}

/**
 * Generic RxJS-backed state primitive that feels like useState.
 *
 * Two modes:
 * 1) Tuple mode (no name):
 * const [setX, getX, useX, x$] = createRxState<T>(defaultValue)
 *
 * 2) Named mode (with name): returns an object whose keys are derived from the name,
 * AND it is cached globally by that name (singleton). Re-using the same name returns the same subject.
 * const { setHeader, getHeader, useHeader, headerSubject } = createRxState<HeaderState>(null, 'header')
 */
export function createRxState<T>(
	defaultValue: T,
): readonly [(u: Updater<T>) => void, () => T, () => T, BehaviorSubject<T>];
export function createRxState<T, N extends string>(
	defaultValue: T,
	name: N,
): NamedSet<N, T> & NamedGet<N, T> & NamedUse<N, T> & NamedSubject<N, T>;
export function createRxState<T, N extends string>(defaultValue: T, name?: N) {
	// Named mode with global cache
	if (name) {
		if (!__globalRxRegistry.has(name)) {
			const entry = makeEntry(new BehaviorSubject<T>(defaultValue));
			__globalRxRegistry.set(name, entry);
		}
		// else {
		//     if (process.env.NODE_ENV !== 'production') {
		//         console.warn(
		//             `createRxState: defaultValue for name=\"${name}\" was ignored because it already exists in the global registry.`
		//         );
		//     }
		// }
		const entry = __globalRxRegistry.get(name) as RxEntry<T>;
		const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
		const obj: Record<string, unknown> = {};
		obj[`set${cap(name)}`] = entry.set;
		obj[`get${cap(name)}`] = entry.get;
		obj[`use${cap(name)}`] = entry.useValue;
		obj[`${name}Subject`] = entry.subject;
		return obj as NamedSet<N, T> &
			NamedGet<N, T> &
			NamedUse<N, T> &
			NamedSubject<N, T>;
	}

	// Tuple mode (no name): not cached; each call creates a new subject
	const entry = makeEntry(new BehaviorSubject<T>(defaultValue));
	return [entry.set, entry.get, entry.useValue, entry.subject] as const;
}

/** ------------------
 * Registry helper functions (optional)
 * ------------------*/
export function hasRxState(name: string) {
	return __globalRxRegistry.has(name);
}
export function getRxSubject<T = unknown>(name: string) {
	const e = __globalRxRegistry.get(name) as RxEntry<T> | undefined;
	return e?.subject;
}
export function clearRxState(name: string) {
	const e = __globalRxRegistry.get(name) as RxEntry<unknown> | undefined;
	if (e) {
		// complete the subject for good measure (listeners can clean up)
		e.subject.complete();
	}
	__globalRxRegistry.delete(name);
}
export function listRxStates() {
	return Array.from(__globalRxRegistry.keys());
}

export function bindDynamicRxStateName<T>(defaultValue: T, name: string) {
	// 이름으로 등록(없으면 생성)
	if (!__globalRxRegistry.has(name)) {
		const entry = makeEntry(new BehaviorSubject<T>(defaultValue));
		__globalRxRegistry.set(name, entry);
	}
	const e = __globalRxRegistry.get(name) as RxEntry<T>;
	// 언제나 튜플로 반환
	return [e.set, e.get, e.useValue, e.subject] as const;
}
