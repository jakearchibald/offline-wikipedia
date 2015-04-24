module.exports = function(date) {
  var month = date.getMonth()+1 < 10 ? '0' + (date.getMonth()+1) : date.getMonth()+1;
  var day = date.getDate() < 10 ? '0' + date.getDate() : date.getDate();
  var hours = date.getHours() < 10 ? '0' + date.getHours() : date.getHours();
  var minutes = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes();
  return `${date.getFullYear()}/${month}/${day} ${hours}:${minutes}`;
};