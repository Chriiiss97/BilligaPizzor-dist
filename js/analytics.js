(() => {
	const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
	const configuredApiUrl = window.BILLIGAPIZZOR_ANALYTICS_API_URL;
	const endpointCandidates = configuredApiUrl
		? [configuredApiUrl]
		: isLocalHost
			? ["http://localhost:3000/api/track/interaction"]
			: [new URL("/api/track/interaction", location.origin).toString()];

	const postToEndpoint = (endpoint, body) =>
		fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body,
			keepalive: true,
			mode: "cors",
		})
			.then((res) => res.ok)
			.catch(() => false);

	const sessionKey = "billigapizzor_public_session_id";
	const sessionId =
		localStorage.getItem(sessionKey) ||
		`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
	localStorage.setItem(sessionKey, sessionId);

	const selectorFromElement = (element) => {
		if (!element) return;
		const id = element.id ? `#${element.id}` : "";
		const classes = [...(element.classList || [])].slice(0, 2).join(".");
		if (!id && !classes) return element.tagName.toLowerCase();
		return `${element.tagName.toLowerCase()}${id || ""}${classes ? `.${classes}` : ""}`;
	};

	const sendEvent = (payload) => {
		const body = JSON.stringify({ ...payload, sessionId });
		try {
			if (navigator.sendBeacon && endpointCandidates.length === 1) {
				const blob = new Blob([body], { type: "application/json" });
				const sent = navigator.sendBeacon(endpointCandidates[0], blob);
				if (sent) return;
			}

			const [primaryEndpoint, ...fallbackEndpoints] = endpointCandidates;
			void postToEndpoint(primaryEndpoint, body).then((ok) => {
				if (ok || fallbackEndpoints.length === 0) return;
				void fallbackEndpoints.reduce(
					(chain, endpoint) =>
						chain.then((sent) => {
							if (sent) return true;
							return postToEndpoint(endpoint, body);
						}),
					Promise.resolve(false)
				);
			});
		} catch (_) {
			// Keep tracking failures non-blocking for the site.
		}
	};

	sendEvent({
		kind: "page_view",
		path: location.pathname,
		title: document.title,
		referrer: document.referrer,
		metadata: {
			search: location.search,
			viewport: `${innerWidth}x${innerHeight}`,
		},
	});

	document.addEventListener(
		"click",
		(event) => {
			const target =
				event.target instanceof HTMLElement
					? event.target.closest("a,button,[role='button'],[data-track],input[type='submit']")
					: null;
			if (!target) return;

			sendEvent({
				kind: "click",
				path: location.pathname,
				label: (target.textContent || target.getAttribute("aria-label") || "okand")
					.trim()
					.slice(0, 140),
				href: target instanceof HTMLAnchorElement ? target.href : undefined,
				tag: target.tagName.toLowerCase(),
				selector: selectorFromElement(target),
				title: document.title,
			});
		},
		{ capture: true }
	);

	document.addEventListener(
		"submit",
		(event) => {
			const form = event.target instanceof HTMLFormElement ? event.target : null;
			if (!form) return;

			sendEvent({
				kind: "form_submit",
				path: location.pathname,
				label: form.getAttribute("name") || form.getAttribute("id") || "form_submit",
				tag: "form",
				selector: selectorFromElement(form),
				title: document.title,
			});
		},
		{ capture: true }
	);
})();
