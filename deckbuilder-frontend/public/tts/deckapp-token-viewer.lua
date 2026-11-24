-- DeckApp token viewer for Tabletop Simulator.
-- The lineup is alphabetical, and the arrows move a page at a time.
-- Clear empties the lineup. Right-click Clear to refresh this script.

local SCRIPT_URL = "https://raw.githubusercontent.com/VicariousX/DeckApp/main/deckbuilder-frontend/public/tts/deckapp-token-viewer.lua"
local COLORS = {"White","Brown","Red","Orange","Yellow","Green","Teal","Blue","Purple","Pink","Black"}
local VISIBLE = 3
local owner = ""
local order = {}
local names = {}
local known = {}
local released = {}
local scroll = 0
local busy = false
local pipCount = 0
local tileW, tileD, tileT = nil, nil, nil
local lastX, lastY, lastZ, lastYaw = nil, nil, nil, nil

function hiddenFrom(color)
  if not color or color == "" then return {} end
  local list = {}
  for _, name in ipairs(COLORS) do
    if name ~= color then table.insert(list, name) end
  end
  return list
end

function vadd(a, b, scale)
  scale = scale or 1
  return { x = a.x + b.x * scale, y = a.y + b.y * scale, z = a.z + b.z * scale }
end

function basis()
  local yaw = 0
  pcall(function() yaw = self.getRotation().y end)
  local forward = { x = 0, y = 0, z = 1 }
  local right = { x = 1, y = 0, z = 0 }
  local okF, f = pcall(function() return self.getTransformForward() end)
  local okR, r = pcall(function() return self.getTransformRight() end)
  if okF and f then forward = f end
  if okR and r then right = r end
  return forward, right, yaw
end

function worldExtents()
  if tileW and tileD and tileT then return tileW, tileD, tileT end
  local size = { x = 6, y = 0.2, z = 4 }
  pcall(function()
    local bounds = self.getBounds()
    if bounds and bounds.size then size = bounds.size end
  end)
  local yaw = 0
  pcall(function() yaw = math.rad(self.getRotation().y) end)
  local c = math.abs(math.cos(yaw))
  local s = math.abs(math.sin(yaw))
  local det = c * c - s * s
  local width, depth
  if math.abs(det) < 0.25 then
    width = math.max(size.x, size.z)
    depth = math.min(size.x, size.z)
  else
    width = math.abs((size.x * c - size.z * s) / det)
    depth = math.abs((size.z * c - size.x * s) / det)
  end
  if width < 1 then width = math.max(size.x, size.z) end
  if depth < 0.6 then depth = math.min(size.x, size.z) end
  tileW, tileD, tileT = width, depth, size.y or 0.2
  return tileW, tileD, tileT
end

function localHalf()
  local scale = { x = 1, y = 1, z = 1 }
  pcall(function() scale = self.getScale() end)
  local width, depth = worldExtents()
  local hx = width / (2 * math.max(0.05, math.abs(scale.x or 1)))
  local hz = depth / (2 * math.max(0.05, math.abs(scale.z or 1)))
  return hx, hz
end

function claim(color)
  if color and color ~= "" and color ~= "Grey" then owner = color end
end

function maxScroll()
  return math.max(0, #order - VISIBLE)
end

function pageCount()
  return math.max(1, math.ceil(#order / VISIBLE))
end

function cardName(guid)
  if names[guid] and names[guid] ~= "" and names[guid] ~= "card" then
    return names[guid]
  end
  local obj = getObjectFromGUID(guid)
  if not obj then return names[guid] or "" end
  local name = ""
  pcall(function() name = obj.getName() or "" end)
  if name == "" or name:lower() == "card" then
    pcall(function()
      local data = JSON.decode(obj.getJSON() or "")
      if data and data.Nickname and data.Nickname ~= "" then name = data.Nickname end
    end)
  end
  name = tostring(name or ""):lower():gsub("^%s+", ""):gsub("%s+$", "")
  if name ~= "" and name ~= "card" then names[guid] = name end
  return name
end

function sortOrder()
  table.sort(order, function(a, b)
    local left = cardName(a)
    local rightName = cardName(b)
    if left == rightName then return a < b end
    return left < rightName
  end)
end

function onSave()
  return JSON.encode({
    owner = owner,
    order = order,
    scroll = scroll,
    width = tileW,
    depth = tileD,
    thick = tileT,
  })
end

function remember()
  self.script_state = onSave()
end

function onLoad(saved)
  local raw = saved
  if not raw or raw == "" then raw = self.script_state end
  if raw and raw ~= "" then
    local data = JSON.decode(raw) or {}
    if data.owner then owner = data.owner end
    if data.width and data.depth then
      tileW, tileD, tileT = data.width, data.depth, data.thick or 0.2
    end
    if type(data.order) == "table" then
      order = {}
      known = {}
      for _, guid in ipairs(data.order) do
        if type(guid) == "string" and guid ~= "" then
          table.insert(order, guid)
          known[guid] = true
        end
      end
      scroll = tonumber(data.scroll) or 0
    end
  end
  self.setLock(false)
  self.sticky = false
  self.setName("Token Viewer")
  self.setDescription("Add keeps the lineup. Clear empties it. Right-click Clear to refresh.")
  buildChrome()
  Wait.time(function()
    local live = {}
    known = {}
    for _, guid in ipairs(order) do
      if getObjectFromGUID(guid) then
        table.insert(live, guid)
        known[guid] = true
      end
    end
    order = live
    scroll = math.max(0, math.floor(scroll / VISIBLE)) * VISIBLE
    sortOrder()
    layout()
    remember()
  end, 0.4)
end

function buildChrome()
  self.clearButtons()
  local hx, hz = localHalf()
  local buttonY = 0.22
  local zRow = hz * 0.48
  local zBar = hz * 0.86
  local ink = {0.12, 0.09, 0.18}
  local font = {0.94, 0.91, 1}
  self.createButton({
    click_function = "viewPrev", function_owner = self, label = "<",
    position = {-hx * 0.78, buttonY, zRow}, width = 380, height = 300, font_size = 160,
    color = ink, font_color = font,
  })
  self.createButton({
    click_function = "addSelected", function_owner = self, label = "Add",
    position = {0, buttonY, zRow}, width = 320, height = 220, font_size = 90,
    color = ink, font_color = font,
  })
  self.createButton({
    click_function = "viewNext", function_owner = self, label = ">",
    position = {hx * 0.78, buttonY, zRow}, width = 380, height = 300, font_size = 160,
    color = ink, font_color = font,
  })
  self.createButton({
    click_function = "clearOrRefresh", function_owner = self, label = "Clear",
    position = {hx * 0.78, buttonY, zBar}, width = 160, height = 80, font_size = 44,
    color = {0.18, 0.14, 0.28}, font_color = font,
    tooltip = "Clears the lineup. Right-click to refresh the script.",
  })
  pipCount = math.max(1, math.min(12, pageCount()))
  local span = hx * 1.15
  for i = 0, pipCount - 1 do
    local x = pipCount == 1 and 0 or (-span / 2 + span * (i / (pipCount - 1)))
    self.createButton({
      click_function = "pip" .. i, function_owner = self, label = "",
      position = {x, buttonY, zBar}, width = 90, height = 70, font_size = 40,
      color = {0.22, 0.18, 0.32}, font_color = font,
    })
  end
  paintPips()
end

function paintPips()
  if pipCount <= 0 then return end
  local pages = pageCount()
  local page = math.floor(scroll / VISIBLE)
  local active = page
  if pipCount > 1 and pages > 1 and pipCount ~= pages then
    active = math.floor((page / (pages - 1)) * (pipCount - 1) + 0.5)
  end
  if active > pipCount - 1 then active = pipCount - 1 end
  if active < 0 then active = 0 end
  for i = 0, pipCount - 1 do
    local color = i == active and {0.58, 0.48, 0.82} or {0.22, 0.18, 0.32}
    pcall(function() self.editButton({ index = 4 + i, color = color }) end)
  end
end

function jumpPip(i)
  local pages = pageCount()
  local n = math.max(1, pipCount)
  local page = 0
  if pages > 1 and n > 1 then
    page = math.floor((i / (n - 1)) * (pages - 1) + 0.5)
  end
  scroll = page * VISIBLE
  layout()
  remember()
end

function pip0() jumpPip(0) end
function pip1() jumpPip(1) end
function pip2() jumpPip(2) end
function pip3() jumpPip(3) end
function pip4() jumpPip(4) end
function pip5() jumpPip(5) end
function pip6() jumpPip(6) end
function pip7() jumpPip(7) end
function pip8() jumpPip(8) end
function pip9() jumpPip(9) end
function pip10() jumpPip(10) end
function pip11() jumpPip(11) end

function scrollBy(pages)
  local maxPage = pageCount() - 1
  local page = math.floor(scroll / VISIBLE) + pages
  if page < 0 then page = 0 end
  if page > maxPage then page = maxPage end
  scroll = page * VISIBLE
  layout()
  remember()
end

function refreshScript()
  remember()
  local who = owner ~= "" and owner or "White"
  broadcastToColor("Checking for a new token viewer...", who, {0.8, 0.8, 1})
  WebRequest.get(SCRIPT_URL .. "?t=" .. tostring(os.time()), function(req)
    if req.is_error or req.response_code ~= 200 then
      broadcastToColor("Refresh failed.", who, {1, 0.45, 0.4})
      return
    end
    local body = req.text or ""
    if not body:find("DeckApp token viewer for Tabletop Simulator", 1, true) then
      broadcastToColor("Refresh did not return the viewer. Nothing was changed.", who, {1, 0.55, 0.35})
      return
    end
    remember()
    self.setLuaScript(body)
    broadcastToColor("Token viewer updated.", who, {0.7, 0.9, 0.7})
    self.reload()
  end)
end

function clearOrRefresh(_, color, alt)
  claim(color)
  if alt then
    refreshScript()
    return
  end
  local origin = self.getPosition()
  local _, right = basis()
  local width = worldExtents()
  local drop = vadd(origin, right, width * 0.5 + 1.4)
  drop.y = origin.y + 0.4
  for i, guid in ipairs(order) do
    local obj = getObjectFromGUID(guid)
    if obj then
      local stack = { x = drop.x, y = drop.y + (i - 1) * 0.08, z = drop.z }
      pcall(function()
        obj.setLock(false)
        obj.use_gravity = true
        obj.sticky = false
        obj.setInvisibleTo({})
        obj.setPosition(stack)
      end)
    end
  end
  order = {}
  names = {}
  known = {}
  released = {}
  scroll = 0
  remember()
  buildChrome()
end

function tryRotate(spin, flip, player_color, old_spin, old_flip)
  local dSpin = (spin or 0) - (old_spin or 0)
  local dFlip = (flip or 0) - (old_flip or 0)
  if dSpin > 180 then dSpin = dSpin - 360 end
  if dSpin < -180 then dSpin = dSpin + 360 end
  if math.abs(dFlip) < 8 and math.abs(dSpin) > 1 and math.abs(dSpin) < 45 then
    claim(player_color)
    if dSpin > 0 then scrollBy(1) else scrollBy(-1) end
    return false
  end
end

function safeTag(obj)
  if not obj then return "" end
  local tag = ""
  local ok = pcall(function() tag = obj.tag end)
  if not ok then return "" end
  return tag or ""
end

function heldBy(obj)
  local held = false
  pcall(function()
    local color = obj.held_by_color
    held = color ~= nil and color ~= ""
  end)
  return held
end

function selectedObjects(color)
  local list = {}
  local okPlayer, player = pcall(function() return Player[color] end)
  if not okPlayer or not player or not player.getSelectedObjects then return list end
  local ok, found = pcall(function() return player.getSelectedObjects() end)
  if ok and found then list = found end
  return list
end

function addSelected(_, color)
  claim(color)
  if busy then return end
  local queue = {}
  for _, obj in ipairs(selectedObjects(color)) do
    if obj ~= self then
      local tag = safeTag(obj)
      if tag == "Card" or tag == "Deck" then table.insert(queue, obj) end
    end
  end
  if #queue == 0 then
    broadcastToColor("Select a pile or some cards, then click Add.", color, {1, 0.7, 0.4})
    return
  end
  busy = true
  local index = 1
  local function nextItem()
    if index > #queue then
      sortOrder()
      scroll = 0
      busy = false
      remember()
      buildChrome()
      layout()
      Wait.time(function()
        if busy then return end
        sortOrder()
        layout()
        remember()
      end, 0.4)
      return
    end
    local obj = queue[index]
    index = index + 1
    if safeTag(obj) == "Deck" then
      drain(obj, 0, nextItem)
    else
      adopt(obj)
      nextItem()
    end
  end
  nextItem()
end

function drain(obj, depth, done)
  depth = (depth or 0) + 1
  if depth > 80 or not obj then
    if done then done() end
    return
  end
  local tag = safeTag(obj)
  if tag == "Card" then
    adopt(obj)
    if done then done() end
    return
  end
  if tag ~= "Deck" then
    if done then done() end
    return
  end
  local guid = ""
  local anchor = self.getPosition()
  pcall(function() guid = obj.getGUID() end)
  pcall(function() anchor = obj.getPosition() end)
  local ok = pcall(function()
    obj.takeObject({
      smooth = false,
      flip = false,
      callback_function = function(card)
        adopt(card)
        Wait.time(function()
          local live = guid ~= "" and getObjectFromGUID(guid) or nil
          if live and safeTag(live) == "Deck" then
            drain(live, depth, done)
            return
          end
          if live and safeTag(live) == "Card" then adopt(live) end
          sweepNear(anchor)
          if done then done() end
        end, 0.08)
      end,
    })
  end)
  if not ok then
    sweepNear(anchor)
    if done then done() end
  end
end

function sweepNear(anchor)
  if not anchor then return end
  for _, obj in ipairs(getAllObjects()) do
    if safeTag(obj) == "Card" and obj ~= self then
      local pos = nil
      local ok = pcall(function() pos = obj.getPosition() end)
      if ok and pos then
        local dx = pos.x - anchor.x
        local dz = pos.z - anchor.z
        local dy = pos.y - anchor.y
        if dx * dx + dz * dz < 4 and dy * dy < 4 then adopt(obj) end
      end
    end
  end
end

function adopt(obj)
  local guid = ""
  pcall(function() guid = obj.getGUID() end)
  if guid == "" or known[guid] or released[guid] or guid == self.getGUID() then return end
  if safeTag(obj) ~= "Card" then return end
  known[guid] = true
  table.insert(order, guid)
  pcall(function()
    obj.setLock(false)
    obj.use_gravity = false
    obj.sticky = false
    obj.setInvisibleTo(hiddenFrom(owner))
  end)
end

function selectedGuids()
  local map = {}
  for _, guid in ipairs(order) do
    local obj = getObjectFromGUID(guid)
    if obj and heldBy(obj) then map[guid] = true end
  end
  for _, color in ipairs(COLORS) do
    local ok, player = pcall(function() return Player[color] end)
    if ok and player and player.getSelectedObjects then
      local okList, list = pcall(function() return player.getSelectedObjects() end)
      if okList and list then
        for _, obj in ipairs(list) do
          local guid = ""
          pcall(function() guid = obj.getGUID() end)
          if guid ~= "" and known[guid] then map[guid] = true end
        end
      end
    end
  end
  return map
end

function lineupTouched()
  return next(selectedGuids()) ~= nil
end

function layout()
  if not lineupTouched() then
    sortOrder()
    local maxPage = pageCount() - 1
    local page = math.floor(scroll / VISIBLE)
    if page < 0 then page = 0 end
    if page > maxPage then page = maxPage end
    scroll = page * VISIBLE
  end
  local origin = self.getPosition()
  local forward, right, yaw = basis()
  local up = { x = 0, y = 1, z = 0 }
  local okUp, lifted = pcall(function() return self.getTransformUp() end)
  if okUp and lifted then up = lifted end
  local width, depth, thick = worldExtents()
  local spacing = 2.6
  local lift = math.max(1.15, (thick or 0.2) * 0.5 + 1.05)
  local along = (depth / 6) - 1.7
  local picked = selectedGuids()
  local shown = 0
  for i = scroll + 1, math.min(#order, scroll + VISIBLE) do
    if getObjectFromGUID(order[i]) then shown = shown + 1 end
  end
  local span = math.max(0, shown - 1) * spacing
  local visual = 0
  for i, guid in ipairs(order) do
    local obj = getObjectFromGUID(guid)
    if obj and not heldBy(obj) then
      if i > scroll and i <= scroll + VISIBLE then
        visual = visual + 1
        local pos = vadd(origin, forward, along)
        pos = vadd(pos, right, -span / 2 + (visual - 1) * spacing)
        pos = vadd(pos, up, lift)
        pcall(function()
          obj.use_gravity = false
          obj.sticky = false
          obj.setRotation({ x = 0, y = yaw, z = 0 })
          obj.setInvisibleTo(hiddenFrom(owner))
          if picked[guid] then
            obj.setLock(false)
          else
            obj.setLock(next(picked) ~= nil)
            obj.setPosition(pos)
          end
        end)
      else
        pcall(function()
          obj.use_gravity = false
          obj.setLock(true)
          obj.setPosition({ x = origin.x, y = origin.y - 12, z = origin.z })
          obj.setInvisibleTo(COLORS)
        end)
      end
    end
  end
  local pages = pageCount()
  local want = math.max(1, math.min(12, pages))
  if want ~= pipCount then buildChrome() else paintPips() end
  local page = math.floor(scroll / VISIBLE) + 1
  pcall(function() self.setName("Token Viewer  " .. page .. "/" .. pages) end)
end

function releaseHeld(guid, index)
  local obj = getObjectFromGUID(guid)
  if not obj then return end
  local _, _, yaw = basis()
  local pos = { x = 0, y = 2, z = 0 }
  pcall(function() pos = obj.getPosition() end)
  local copy = nil
  pcall(function()
    copy = obj.clone({ position = { x = pos.x, y = pos.y + 0.3, z = pos.z } })
  end)
  released[guid] = true
  known[guid] = nil
  pcall(function()
    obj.setInvisibleTo({})
    obj.use_gravity = true
  end)
  if copy then
    local copyGuid = ""
    pcall(function() copyGuid = copy.getGUID() end)
    if copyGuid ~= "" then
      known[copyGuid] = true
      order[index] = copyGuid
      pcall(function()
        copy.use_gravity = false
        copy.setRotation({ x = 0, y = yaw, z = 0 })
        copy.setInvisibleTo(hiddenFrom(owner))
      end)
    end
  else
    table.remove(order, index)
  end
  layout()
  remember()
end

local wasTouched = false

function onUpdate()
  local moved = false
  local p = self.getPosition()
  local yaw = 0
  pcall(function() yaw = self.getRotation().y end)
  if not lastX
    or math.abs(p.x - lastX) + math.abs(p.y - lastY) + math.abs(p.z - lastZ) > 0.02
    or math.abs((yaw or 0) - (lastYaw or 0)) > 0.5 then
    lastX, lastY, lastZ, lastYaw = p.x, p.y, p.z, yaw
    moved = true
  end
  if #order == 0 then
    wasTouched = false
    return
  end
  for i = #order, 1, -1 do
    local guid = order[i]
    local obj = getObjectFromGUID(guid)
    if not obj then
      table.remove(order, i)
      known[guid] = nil
      names[guid] = nil
      remember()
    elseif heldBy(obj) then
      releaseHeld(guid, i)
    end
  end
  local touched = lineupTouched()
  if (moved or (wasTouched and not touched)) and not touched then layout() end
  wasTouched = touched
end

function viewPrev(_, color)
  claim(color)
  scrollBy(-1)
end

function viewNext(_, color)
  claim(color)
  scrollBy(1)
end
