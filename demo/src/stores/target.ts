import { atom, onSet } from "nanostores";

const STORAGE_KEY = "target";

export const $target = atom(localStorage.getItem(STORAGE_KEY) || "");

onSet($target, ({ newValue }) => {
	localStorage.setItem(STORAGE_KEY, newValue);
});
