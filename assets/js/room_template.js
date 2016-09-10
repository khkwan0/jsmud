var room_template = '\
<form id="form_area" action="#" >\
    <div>\
        <label>Realm</label><input id="realm" value="" readonly />\
    </div>\
    <div>\
        <label>Name</label>\
        <input name="name" id="name" value="" placeholder="Name" />\
    </div>\
    <div>\
        <label>Long</label>\
        <textarea name="long" id="long" value="" placeholder="long description"></textarea>\
    </div>\
    <div>\
        <label>Short</label>\
        <input name="short" id="short" value="" placeholder="Short description" />\
    </div>\
    <div>\
        <label>EXITS</label>\
        <div id="exits_inp">\
        </div>\
    </div>\
</form>\
<button id="add_exit">Add Exit</button>\
<button id="save">Save</button>\
<button id="new">New</button>\
';
