function line(axis, info) {
  var l = document.createElement('line');
  var extent = (axis === 'left' ? 'width' : (axis === 'top' ? 'height' : axis));
  l.setAttribute('extent', extent);
  var p = info.p;
  if (p < 0 || info.s < 0) {
    axis = (axis === 'left' ? 'right' : (axis === 'top' ? 'bottom' : axis));
  }
  p = Math.abs(p);
  l.style[axis] = p + 'px';
  l.style[extent] = '0px';
  document.body.appendChild(l);
}

function lines() {
  for (var o in columns) {
    line('left', columns[o]);
  }
  for (var o in rows) {
    line('top', rows[o]);
  }
}

function rail(list, key) {
  if (key === 'min' || key === 0) {
    return {p: 0, s: 0};
  } else if (key === 'max' || key >= list.length) {
    return {p: 0, s: -1};
  }
  var obj = list[key];
  if (obj.p < 0) {
    obj.s = -1;
    obj.p *= -1;
  }
  return obj;
}

function _position(box, maj, min, ext, a, b) {
  var m = 12;
  if (a.s < 0 && b.s < 0) {
    box[ext] = a.p - b.p - m - m - m + 'px';
    box[min] = b.p + m + 'px';
  } else if (b.s < 0) {
    box[maj] = a.p + m + 'px';
    box[min] = b.p + m + 'px';
  } else {
    box[maj] = a.p + m + 'px';
    box[ext] = b.p - a.p - m - m - m + 'px';
  }
}

function position(elt, top, right, bottom, left) {
  _position(elt.style, 'top', 'bottom', 'height', rail(rows, top), rail(rows, bottom));
  _position(elt.style, 'left', 'right', 'width', rail(columns, left), rail(columns, right));
}

function matrixilate(matrix, nodes) {
  rows = [];
  columns = [];
  matrix.forEach(function(vector, i) {
    var row = rows[i];
    if (!row) {
      if (i > matrix.length / 2) {
        var s = -140 * (matrix.length - i);
      } else {
        s = 140 * i;
      }
      rows[i] = {p: s};
    }
    vector.forEach(function(cols, i) {
      var col = columns[i];
      if (!col) {
        if (i > vector.length / 2) {
          var s = -140 * (vector.length - i);
        } else {
          s = 140 * i;
        }
        columns[i] = {p: s};
      }
    });
  });
  console.log('columns', columns);
  //
  var l = 0;
  var rowCount = matrix.length;
  var colCount = rowCount && matrix[0].length || 0;
  for (var i=0; i<colCount; i++) {
    var contained = [];
    for (var j=0; j<rowCount; j++) {
      var col = matrix[j]
      var nodei = col[i];
      if (nodei) {
        if ((i === 0 && (i == colCount-1 || nodei !== col[i+1])) || (i == colCount - 1 && (i === 0 || nodei === col[i-1])) || (nodei !== col[i-1] && nodei !== col[i+1])) {
          contained[nodei] = 1;
        }
      }
    }
    // sizing function for column 0
    if (i === 0) {
      //console.log(i);
      for (var col in contained) {
        l += nodes[Number(col) - 1].offsetWidth + 24;
        columns[i + 1] = {p: l};
        break;
      }
    } else if (i < colCount-1) {
      /*
      var has = false;
      for (var col in contained) {
        has = true;
        break;
      }
      var p = 0;
      if (has) {
        l += 140;
        p = l;
      }
      columns[i + 1] = {p: p};
      */
      l += 140;
      columns[i + 1] = {p: l};
    }
  }
  console.log('columns', columns);
  //
  lines();
  nodes.forEach(function(node, i) {
    var n = i+1, l, r, t = 1e10, b = -1e10;
    matrix.forEach(function(vector, i) {
      var f = vector.indexOf(n);
      if (f > -1) {
        l = f;
        r = vector.lastIndexOf(n) + 1;
        t = Math.min(t, i);
        b = Math.max(b, i) + 1;
      }
    });
    console.log(l, r, t, b);
    position(node, t, r, b, l);
  });
}
