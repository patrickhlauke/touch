Polymer('tracks-app', {
  arrangements: [
    [
      [1, 1, 1],
      [2, 3, 5],
      [2, 3, 4]
    ],
    [
      [5, 3, 2],
      [4, 3, 2],
      [4, 1, 1]
    ],
    [
      [1, 1],
      [2, 3],
      [5, 3]
    ]
  ],
  outputLayout: 0,
  ready: function() {
    this.outputLayoutChanged();
  },
  outputLayoutChanged: function() {
      this.layout(this.arrangements[this.outputLayout]);
  },
  layout: function(arrangement) {
      layout(
      arrangement || this.arrangement,
      [this.$.toolbar, this.$.sidebar, this.$.workspace, this.$.output, this.$.outputToolbar]
      // parent for line objects, if desired
      //,this.shadowRoot
    );
  },
  toggleLayout: function() {
    this.outputLayout = (this.outputLayout + 1) % this.arrangements.length;
  }
});
