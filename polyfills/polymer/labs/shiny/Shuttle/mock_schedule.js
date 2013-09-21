(function() {

if (!window.Shuttle || Polymer.flags.mock) {
  window.Shuttle = {
    isMock: true,
    groups: [
      {
        name: 'Remote'
      },
      {
        name: 'Office'
      }
    ],
    stops: [
      {
        description: 'Pick up is located near the main park gate.',
        group: 0,
        in_lat: 38.15966,
        in_lon: -122.26149,
        is_work: false,
        name: 'Kimberly Park, American Canyon',
        out_lat: 38.15966,
        out_lon: -122.26149,
        short_name: 'Kimberly Park',
        trips: [0, 1]
      },
      {
        description: 'Pick up in on the eastside of office building.',
        group: 1,
        in_lat: 37.77935,
        in_lon: -122.41874,
        is_work: true,
        name: 'City Hall, San Francisco',
        out_lat: 37.77935,
        out_lon: -122.41874,
        short_name: 'City Hall',
        trips: [0, 1]
      }
    ],
    trips: [
      {
        businfo: "11",
        dir: "in",
        headsign: "head",
        name: "KP CH",
        stops: [
          {
            stop: 0,
            time: "07:00 AM"
          },
          {
            stop: 1,
            time: "08:30 AM"
          }
        ]
      },
      {
        businfo: "99",
        dir: "out",
        headsign: "head",
        name: "CH KP",
        stops: [
          {
            stop: 1,
            time: "05:10 PM"
          },
          {
            stop: 0,
            time: "06:40 PM"
          }
        ]
      }
    ]
  };
}

})();