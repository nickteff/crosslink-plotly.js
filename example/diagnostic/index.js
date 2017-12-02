const {cfEnabled, cfLayoutOverrides, cfPlotSetup} = window['crosslink-plotly'].js

const crossfiltering = true

const plots = all_sets

const renderOneDiv = idArray => {
  const root = idArray.length ? document.getElementById(`gd_${idArray.slice(0, -1).join('_')}`) : document.body
  const div = document.createElement('div')
  div.setAttribute('id', `gd_${idArray.join('_')}`)
  if(idArray.length) {
    div.setAttribute('class', 'plot-container')
  }
  root.appendChild(div)
  return div
}

const histogram = true

// render a root container
renderOneDiv([])

const renderedDivs = []

const offset = 1
plots.slice(offset, 31).forEach((dataset, i) => {
  const plotEl = renderOneDiv([`wbcd_${i}`], true)
  const data = histogram
    ? [{
      type: 'histogram',
      x: dataset,
      xsrc: 'dependent_' + i
    }]
    : [{
      type: 'scatter',
      mode: 'markers',
      marker: {
        size: 3,
        opacity: 1,
        color: plots[plots.length - 1].map(d => d === 'M' ? 1 : -1),
        colorsrc: 'class'
      },
      x: dataset.map((d, i) => i),
      xsrc: 'independent_' + i,
      y: dataset,
      ysrc: 'dependent_' + i
  }]
  const layout = Object.assign({}, {
    width: 330,
    height: 175,
    margin: {t: 30, b: 34, l: 40, r: 20},
    xaxis: {title: set_names[offset + i]}
  }, cfLayoutOverrides)
  const plotContent = {data, layout}
  const crossfilterEnabled = cfEnabled(crossfiltering, plotContent);
  const plot = Plotly.plot(plotEl, data, layout);
  if (crossfilterEnabled) {
    cfPlotSetup(Plotly, renderedDivs, plot, plotEl, plotContent);
  }
  renderedDivs.push(plotEl)
})