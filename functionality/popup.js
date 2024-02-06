let bg;
let carbonPerPage = 1.76;	// Average carbon per page view

chrome.tabs.getSelected(null, function (tab) {
	bg = chrome.extension.getBackgroundPage();
	renderPage();
});

function formatCarbonWeight(value) {
	let suffix = "g";
	if (value >= 1000000000) {
		value = value / 1000000000;
		suffix = "mmt";
	} else if (value >= 1000000) {
		value = value / 1000000;
		suffix = "mt";
	} else if (value >= 1000) {
		value = value / 1000;
		suffix = "kg";
	}
	value = value % 1 == 0 ? value : value.toFixed(1)
	return value + suffix;
}

function renderPage() {
	let today = bg.getDayCount(0)
	let todayCarbon = document.getElementById('today-carbon');
	todayCarbon.innerHTML = formatCarbonWeight(today * carbonPerPage);

	let dayArr = [];
	let chart = document.getElementById('chart');
	for (let i = 29; i >= 0; i--) {
		let dayCount = bg.getDayCount(i);
		dayArr[i] = dayCount * carbonPerPage;
	}
	let max = dayArr.length ? Math.max.apply(null, dayArr) : 0;

	let columnHeight = 120.0;
	let ratio = columnHeight / max;
	let bar = null;
	let sum = 0;
	let days = 0;
	chart.style.height = (parseInt(columnHeight)) + 'px';

	for (let i = 29; i >= 0; i--) {
		let dayCount = dayArr[i];
		let barHeight = parseInt(dayCount * ratio);

		let column = document.createElement('div');
		column.setAttribute('class', 'chart-column');
		column.setAttribute('title', formatCarbonWeight(dayCount) + ' on ' + bg.formatDate(i, '-'));
		column.style.height = parseInt(columnHeight) + 'px';

		let area = document.createElement('div');
		area.setAttribute('class', 'chart-area');
		area.style.height = parseInt(columnHeight) + 'px';
		column.appendChild(area);

		let barWrap = document.createElement('div');
		barWrap.setAttribute('class', 'chart-bar-wrap');
		barWrap.style.height = barHeight + 'px';
		area.appendChild(barWrap);

		bar = document.createElement('div');
		bar.setAttribute('class', 'chart-bar');
		if (i == 0) {
			bar.setAttribute('class', 'chart-bar today');
		}
		bar.style.height = barHeight + 'px';
		barWrap.appendChild(bar);
		chart.appendChild(column);

		if (dayCount > 0) {
			sum += dayCount;
			days++;
		}
	}

	if (days > 7) {
		let chartDefault = document.getElementById('chart-default');
		chartDefault.setAttribute('class', 'chart-default-hidden');
	}

	let avgDay = sum / days;
	if (avgDay) {
		let year = avgDay * 365;
		let fc = document.getElementById('forecast-count');
		fc.innerHTML = formatCarbonWeight(year);

		let trees = 24 * 1000;
		let flight = 50 * 1000;
		if (year >= flight) {
			let ft = document.getElementById('trees');
			let fe = document.getElementById('flights');
			ft.innerHTML = "🌴  You need to plant " + (year / trees).toFixed(0) + " trees to offset this amount.";
			fe.innerHTML = "🛫  Whoa! That's equivalent to " + (year / flight).toFixed(0) + " flights between New York and LA! ";
		}
	}
}
