var obj_template ='\
<form id="form_area" action="#" >\
    <div>\
        <label>realm</label><input id="realm" value="" readonly />\
    </div>\
    <div>\
        <label>name</label>\
        <input name="name" id="name" value="" placeholder="Name" />\
    </div>\
    <div>\
        <label>alias</label>\
        <input name="alias" id="alias" value="" placeholder="Alias - another name" />\
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
        <label>invisible</label>\
        <input type="checkbox" id="invisible" />\
    </div>\
    <div>\
        <label>can_get</label>\
        <input type="checkbox" id="can_get" />\
    </div>\
    <div>\
        <label>can_wield</label>\
        <input type="checkbox" id="can_wield" />\
    </div>\
    <div>\
        <label>max_damage</label>\
        <input id="max_damage"  value="0" />\
    </div>\
    <div>\
        <label>min_damage</label>\
        <input id="min_damage" value="0"  />\
    </div>\
    <div>\
        <label>can_block</label>\
        <input type="checkbox" id="can_block" />\
    </div>\
    <div>\
        <label>origin</label>\
        <input id="origin" value="" />\
    </div>\
    <div>\
        <label>edible</label>\
        <input type="checkbox" id="edible" />\
    </div>\
    <div>\
        <label>drinkable</label>\
        <input type="checkbox" id="drinakble" />\
    </div>\
    <div>\
        <label>heal</label>\
        <input  id="heal" value="0" />\
    </div>\
    <div>\
        <label>weight</label>\
        <input  id="heal" value="0" placeholder="Iteam weight"/>\
    </div>\
    <div>\
        <label>is_bag</label>\
        <input type="checkbox" id="is_bag" />\
    </div>\
    <div>\
        <label>max_items</label>\
        <input  id="max_items" value="0" placeholder="Max # of items is_bag can hold" />\
    </div>\
    <div>\
        <label>max_weight</label>\
        <input  id="max_weight" value="0" placeholder="Max weight is_bag can hold" />\
    </div>\
    <div id="inv_inp">\
        <label>inv</label>\
    </div>\
</form>\
<button id="add_inv">Add inventory</button>\
<button id="save">Save</button>\
<button id="new">New</button>\
';
