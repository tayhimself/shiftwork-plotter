

let response = await fetch("./diary.json")
const allEpisodes = await response.json()


/*****************************************************************************
 *
 * Dropdown to select subject and shift duration
 */
const uniqueRecordIds = new Set()
allEpisodes.forEach((episode) => uniqueRecordIds.add(episode.record_id))
const recordIds = Array.from(uniqueRecordIds)

let dropdown = document.createElement("select")
recordIds.map((recordId) => {
  let opt = document.createElement("option")
  opt.text = recordId
  opt.value = recordId
  dropdown.options.add(opt)
})
document.getElementById("select-subject").appendChild(dropdown)

document.getElementById("select-subject").addEventListener("change", (e) => {
  subject = document.querySelector("div#select-subject select").value
  plotChart(subject, shiftDuration)
})

document.getElementById("shift-duration").addEventListener("change", (e) => {
  shiftDuration = parseInt(document.querySelector("div#shift-duration select").value)
  plotChart(subject, shiftDuration)
})

let subject = document.querySelector("div#select-subject select").value
let shiftDuration = parseInt(document.querySelector("div#shift-duration select").value)
plotChart(subject, shiftDuration)

/******************************************************************************
 * Plotting
 */

function plotChart(subject, shiftDuration) {
  /******************************************************************************
   * Data Normalization and conversion
   */
  let episodes = allEpisodes.filter((episode) => episode.record_id == subject)
  // Make a deep copy of episodes
  episodes = JSON.parse(JSON.stringify(episodes))
  episodes.sort((a, b) => a.start - b.start)
  let tzoffset = new Date(episodes[0].start).getTimezoneOffset() * 60000 //offset in milliseconds
  // Convert episodes to date objects
  episodes = episodes.map((episode) => {
    episode.start = new Date(episode.start)
    episode.end = new Date(episode.end)
    episode.start.setTime(episode.start.getTime() + tzoffset)
    episode.end.setTime(episode.end.getTime() + tzoffset)
    return episode
  })
  episodes.map((episode) => {
    if (episode.type == "shift") {
      episode.end = new Date(episode.start.getTime() + (shiftDuration * 60 * 60 * 1000))
    }
  })
  // Returns number of days of data and a set of unique dates
  const uniqueDays = new Set()
  const numDays = episodes.reduce((acc, episode) => {
    if (uniqueDays.has(episode.date)) return acc
    uniqueDays.add(episode.date)
    return (acc += 1)
  }, 0)

  /******************************************************************************
   * get height, width, margins, and font size in a pseudo-responsive way
   */
  // Legend to be drawn on the right side of the plot
  const legendWidth = 120

  const margin = { top: 25, right: 10, bottom: 25, left: 100 }
  const maxwidth = document.getElementById("chart").clientWidth - margin.left - margin.right - legendWidth
  const width = maxwidth > 2000 ? 2000 : maxwidth

  const desiredHeight = (1 - 1 / numDays) * width
  const maxHeight = window.innerHeight - margin.top - margin.bottom - 50
  const height = desiredHeight > maxHeight ? maxHeight : desiredHeight
  const fontSize = width < 600 ? "0.8rem" : "1rem"
  const largeFontSize = width < 600 ? "1.25rem" : "1.5rem"

  d3.selectAll("#chart > *").remove()

  /******************************************************************************
   * Create SVG
   */

  let x = d3
    .scaleLinear()
    .domain([0, 24])
    .rangeRound([margin.left, width - margin.right])

  const xAxis = (g) =>
    g
      .call(
        d3
          .axisTop(x)
          .ticks(24)
          .tickFormat(formatHours())
          .tickSize(-width + margin.left + margin.right)
          .tickPadding(10)
      )
      .call((g) => g.attr("transform", `translate(0,${margin.top})`))
      .call((g) => g.selectAll(".domain").remove())
      .call((g) => g.selectAll(".tick line").attr("stroke", "#fff").attr("stroke-width",1).attr())
      .call((g) => g.selectAll(".tick line").attr("y2", height-margin.bottom))

  let y = d3
    .scaleTime()
    .domain([d3.timeDay.floor(d3.min(episodes, (d) => d.start)), d3.timeDay.floor(d3.max(episodes, (d) => d.end))])
    .rangeRound([margin.top, height - margin.bottom])

  const yAxis = (g) =>
    g
      .call(d3.axisLeft(y).tickFormat(d3.timeFormat("%Y-%m-%d")))
      .call((g) => g.attr("transform", `translate(0,${margin.top - 15})`))
      .call((g) => g.selectAll(".tick text").attr("text-anchor", "start").attr("x", 4).attr("font-size", fontSize))

  let svg = d3
    .select("#chart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .attr("style", "background-color: #f0f0f0;")

  const session = svg
    .append("g")
    .attr("fill", "steelblue")
    .selectAll("g")
    .data(episodes)
    .join("g")
    .on("mouseover", (event) => (event.currentTarget.style.fill = "red"))
    .on("mouseout", (event) => (event.currentTarget.style.fill = ""))

  session
    .selectAll("rect")
    .data(dayslice)
    .join("rect")
    .attr("x", ([start]) => x(hours(start)))
    .attr("width", ([start, end]) => x(hours(end) || 24) - x(hours(start)))
    .attr("y", ([start]) => y(d3.timeDay(start)))
    .attr("height", Math.floor((height-margin.top-margin.bottom) / (numDays + 10)) )
    .attr("class", ([, , type]) => type)
  svg.append("g").attr("pointer-events", "none").call(yAxis)
  svg.append("g").attr("pointer-events", "none").call(xAxis)
  return svg
}



function dayslice({ start, end, type } = episodes) {
  let startDay = d3.timeDay(start)
  let endDay = d3.timeDay(end)
  let slices = []
  while (startDay < endDay) {
    startDay = d3.timeDay.offset(startDay)
    slices.push([start, startDay, type])
    start = startDay
  }
  if (start < end) {
    slices.push([start, end, type])
  }
  return slices
}

function hours(date) {
  return (
    date.getHours() + date.getMinutes() / 60 + date.getSeconds() / (60 * 60) + date.getMilliseconds() / (60 * 60 * 1000)
  )
}

function formatHours() {
  const format = d3.utcFormat("%I%p")
  return hours => format(new Date(hours * 60 * 60 * 1000));
}
