import * as toolkitRaw from "@reduxjs/toolkit";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { configureStore } = ((toolkitRaw as any).default ??
	toolkitRaw) as typeof toolkitRaw;
import type { Writable } from "svelte/store";
import { fireworks } from "$lib/components/fireworks";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function svelteStoreEnhancer(createStoreApi: (arg0: any, arg1: any) => any) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return function (reducer: any, initialState: any) {
		const reduxStore = createStoreApi(reducer, initialState);
		return {
			...reduxStore,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			subscribe(fn: (arg0: any) => void) {
				fn(reduxStore.getState());

				return reduxStore.subscribe(() => {
					fn(reduxStore.getState());
				});
			},
		};
	};
}

const reducer = {
	fireworks,
};
const rawStore = configureStore({ reducer, enhancers: [svelteStoreEnhancer] });
export type ReduxStore = typeof rawStore;
export type GlobalState = ReturnType<typeof rawStore.getState>;
type SvelteStore = Writable<GlobalState>;

export const store = rawStore as ReduxStore & SvelteStore;
