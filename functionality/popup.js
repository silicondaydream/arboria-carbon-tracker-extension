// Define background page variable and average carbon footprint per page view
let bg;
let carbonPerPage = 1.76;	// Average carbon per page view in grams

// Fetch the currently selected tab and then initialize the background page and render the page content
chrome.tabs.getSelected(null, function (tab) {
	bg = chrome.extension.getBackgroundPage(); // Access the background page of the extension
	renderPage(); // Call the renderPage function to update the UI with carbon data
});

// Function to format the carbon weight into a readable string with appropriate units
function formatCarbonWeight(value) {
	let suffix = "g"; // Default unit is grams
	// Convert value based on its size to more readable units (metric tons, kilograms)
	if (value >= 1000000000) {
		value = value / 1000000000;
		suffix = "mmt"; // Megametric tons
	} else if (value >= 1000000) {
		value = value / 1000000;
		suffix = "mt"; // Metric tons
	} else if (value >= 1000) {
		value = value / 1000;
		suffix = "kg"; // Kilograms
	}
	value = value % 1 == 0 ? value : value.toFixed(1) // Format to 1 decimal place if not an integer
	return value + suffix;
}

// Function to render the page's dynamic content
function renderPage() {
	let today = bg.getDayCount(0) // Get today's carbon footprint count
	let todayCarbon = document.getElementById('today-carbon');
	todayCarbon.innerHTML = formatCarbonWeight(today * carbonPerPage); // Display formatted carbon weight for today

	let dayArr = [];
	let chart = document.getElementById('chart');
	// Calculate carbon footprint for the past 30 days
	for (let i = 29; i >= 0; i--) {
		let dayCount = bg.getDayCount(i);
		dayArr[i] = dayCount * carbonPerPage;
	}
	let max = dayArr.length ? Math.max.apply(null, dayArr) : 0; // Find the maximum value for scaling the chart

	let columnHeight = 120.0; // Maximum height of the chart columns
	let ratio = columnHeight / max; // Calculate scaling ratio for the chart columns
	let bar = null;
	let sum = 0;
	let days = 0;
	chart.style.height = (parseInt(columnHeight)) + 'px'; // Set chart height

	// Generate chart columns for each of the past 30 days
	for (let i = 29; i >= 0; i--) {
		let dayCount = dayArr[i];
		let barHeight = parseInt(dayCount * ratio); // Scale bar height according to carbon footprint

		let column = document.createElement('div');
		column.setAttribute('class', 'chart-column');
		column.setAttribute('title', formatCarbonWeight(dayCount) + ' on ' + bg.formatDate(i, '-')); // Tooltip showing date and carbon footprint
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
			bar.setAttribute('class', 'chart-bar today'); // Highlight today's column
		}
		bar.style.height = barHeight + 'px';
		barWrap.appendChild(bar);
		chart.appendChild(column);

		if (dayCount > 0) {
			sum += dayCount; // Sum carbon footprint for averaging
			days++;
		}
	}

	// Hide the default chart message if data is available for more than 7 days
	if (days > 7) {
		let chartDefault = document.getElementById('chart-default');
		chartDefault.setAttribute('class', 'chart-default-hidden');
	}

	// Calculate and display the average daily carbon footprint and annual forecast
	let avgDay = sum / days;
	if (avgDay) {
		let year = avgDay * 365; // Forecast annual carbon footprint
		let fc = document.getElementById('forecast-count');
		fc.innerHTML = formatCarbonWeight(year); // Display formatted forecast

		// Calculate equivalent number of trees required for carbon offset and flights' carbon footprint
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
