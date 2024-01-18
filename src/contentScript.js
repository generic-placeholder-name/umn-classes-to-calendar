'use strict';

const weekdays = new Map([
  ["Sunday", 0],
  ["Monday", 1],
  ["Tuesday", 2],
  ["Wednesday", 3],
  ["Thursday", 4],
  ["Friday", 5],
  ["Saturday", 6]
]);

function convertToMOTUWEFormat(daysArray) {
  const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  // Map each number to the corresponding day abbreviation
  const motuweArray = daysArray.map(dayNumber => dayNames[dayNumber]);
  // Join the array elements with commas
  const resultString = motuweArray.join(',');
  return resultString;
}

//TODO: add ability to choose begin & end dates
const beginDate = new Date('2024-01-16 00:00:00');
const endDate = new Date('2024-05-09 00:00:00');

function ClassType(name, type, location, startHour, startMin, endHour, endMin) {
  this.name = name;
  this.type = type;
  this.location = location;
  this.startHour = startHour;
  this.startMin = startMin;
  this.endHour = endHour;
  this.endMin = endMin;
  this.weekdays = [];
  this.startDate = new Date(beginDate);
  this.endDate = new Date(endDate);
}

function formatDateTimeFromDate(date) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());
  return `${year}${month}${day}T${hour}${minute}${second}`;
}

function formatDateTimeFromValues(year, month, day, hour, minute, second) {
  return `${pad(year)}${pad(month)}${pad(day)}T${pad(hour)}${pad(minute)}${pad(second)}`;
}

function pad(i) {
  return i < 10 ? `0${i}` : `${i}`;
}

/**
 * Get the class times from the HTML table
 */
function getClassTimesFromHTML(weeklySchedule) {
  let classDict = new Map();
  const dailySchedules = weeklySchedule.querySelectorAll(".myu_calendar-day");
  if(dailySchedules === null) {
    throw new Error('It appears that you do not have any classes this week. Please try again on a week with all your classes.');
  }
  for (const dailySchedule of dailySchedules) {
    let currentDay = dailySchedule.querySelector("h2").textContent;
    for (const classSession of dailySchedule.querySelectorAll(".myu_calendar-class")) {
      if(classSession.textContent.trim() == "No classes scheduled") continue;
      const className = classSession.querySelector(".myu_calendar-class-name-color-referencer").textContent;
      //Get the class type and location
      const classDetails = classSession.querySelector(".myu_calendar-class-details").innerHTML.split("<br>");
      const classType = classDetails[0];
      const classLocation = classDetails.at(-2).trim();
      //Get the start and end time of the class
      const classTime = classDetails.at(-3);
      const AMPM = classTime.slice(-2);
      const splitTime = classTime.split(/[\s-:]+/);
      let startHour = Number(splitTime[0]);
      let startMin = Number(splitTime[1]);
      let endHour = Number(splitTime[2]);
      let endMin = Number(splitTime[3]);
      if(AMPM == "PM") endHour += 12;
      if(startHour + 12 < endHour || (startHour + 12 == endHour && startMin < endMin)) startHour += 12;
      //Put it in a map
      const key = `${className} ${classType} ${classLocation} ${startHour} ${startMin} ${endHour} ${endMin}` // kludge because js doesn't hash map properly
      if(!classDict.has(key)) classDict.set(key, new ClassType(className, classType, classLocation, startHour, startMin, endHour, endMin));
      classDict.get(key)["weekdays"].push(weekdays.get(currentDay));
    }
  }
  let classData = [];
  classDict.forEach((value, key, map)  => {
    while(!value.weekdays.includes(value.startDate.getDay())) {
      value.startDate.setDate(value.startDate.getDate() + 1);
    }
    classData.push(value);
  });
  return classData;
}


import { nanoid } from 'nanoid';
/**
 * Generate .ics files from class Data.
 */
function generateICSFromClassData(classData) {
  const header = `BEGIN:VCALENDAR
PRODID:UMN Classes to Calendar
VERSION:2.0
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:UMN Classes
X-WR-TIMEZONE:America/Chicago
X-WR-CALDESC:description
BEGIN:VTIMEZONE
TZID:America/Chicago
X-LIC-LOCATION:America/Chicago
BEGIN:DAYLIGHT
TZOFFSETFROM:-0600
TZOFFSETTO:-0500
TZNAME:CDT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0600
TZOFFSETTO:-0500
TZNAME:CST
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
END:VTIMEZONE\n`;
  let calendar = header;
  for (const data of classData) {
    const event = `BEGIN:VEVENT
SUMMARY:${data.name} ${data.type}
DTSTAMP:${formatDateTimeFromDate(new Date(Date.now()))}
DTSTART;TZID=America/Chicago:${formatDateTimeFromValues(data.startDate.getFullYear(), data.startDate.getMonth() + 1, data.startDate.getDate(), data.startHour, data.startMin, 0)}
DTEND;TZID=America/Chicago:${formatDateTimeFromValues(data.startDate.getFullYear(), data.startDate.getMonth() + 1, data.startDate.getDate(), data.endHour, data.endMin, 0)}
RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=${convertToMOTUWEFormat(data.weekdays)};UNTIL=${formatDateTimeFromDate(data.endDate)}
UID:${nanoid()}
LOCATION:${data.location}
SEQUENCE:0
STATUS:CONFIRMED
TRANSP:OPAQUE
END:VEVENT\n`;
      calendar += event;
  }
  const footer = 'END:VCALENDAR';
  calendar += footer;
  return calendar;
}

/**
 * Creates an .ics file and downloads it to computer
 */
function createICSFile(content, filename) {
  // Create a Blob with the content and set MIME type to text/calendar
  const blob = new Blob([content], { type: 'text/calendar' });
  // Create a link element
  const link = document.createElement('a');
  // Set the link's attributes including the filename
  link.href = window.URL.createObjectURL(blob);
  link.download = filename;
  // Append the link to the document
  document.body.appendChild(link);
  // Trigger a click on the link to start the download
  link.click();
  // Remove the link from the document
  document.body.removeChild(link);
}

function onAddToCalendarButtonClick() {
  //Get the schedule for this week
  const weeklySchedule = document.querySelector(".myu_calendar");
  //Extract class information
  try{
    const classData = getClassTimesFromHTML(weeklySchedule);
    let icsFile = generateICSFromClassData(classData);
    createICSFile(icsFile, 'UMNCalendar.ics');
  }
  catch(err) {
    console.log(err);
    alert(`Error: ${err.message}`);
  }
}

/**
 * Code written by Broden Wanner
 * Makes the "add to calendar" button on the page and sets the on click method.
 */
function makeAddToCalendarButton() {
  // Make the button
  const addToCalendarButton = document.createElement("button");
  addToCalendarButton.setAttribute("id", "submit-classes-button");
  addToCalendarButton.innerHTML = `<i class="fa fa-external-link" aria-hidden="true"></i>Add to Calendar`;
  addToCalendarButton.classList.add("btn", "btn-default", "myu_fx-150ms");
  addToCalendarButton.style.cssText = "color: #fff; background-color: rgba(122,0,25,0.75);";
  addToCalendarButton.onclick = onAddToCalendarButtonClick;
  // Add it to the page
  const buttonContainer = document.querySelector(".myu_btn-group");
  buttonContainer.append(addToCalendarButton);
}

/**
 * Code written by Broden Wanner
 * Sets up an observer to create the button when the main body is created
 * @param {Array} mutationsList - List of mutations made
 * @param {Any} observer - Observer object
 */
function mutationCallback(mutationsList, observer) {
  mutationsList.forEach((mutation) => {
    const nodes = Array.from(mutation.addedNodes);
    for (let node of nodes) {
      // Wait for the main body creation
      if (node.matches && node.matches("#ID_UM_SSS_ENRL_SCHEDULE_PGLT > div")) {
        // Check for the button group
        if (node.querySelector(".myu_btn-group")) {
          makeAddToCalendarButton();
          return;
        }
      }
    }
  });
}

/**
 * Code written by Broden Wanner
 * Create the mutation observer and start observing
 */
const observer = new MutationObserver(mutationCallback);
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: false,
  characterData: false,
});
