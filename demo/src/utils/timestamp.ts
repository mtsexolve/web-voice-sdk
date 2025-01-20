export function getCurrentTimestamp() {
	return Math.floor(Date.now() / 1000);
}

export function dateToTimeStamp(date: Date) {
	return Math.floor(+date / 1000);
}
