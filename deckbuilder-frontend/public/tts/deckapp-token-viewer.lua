-- DeckApp token viewer for Tabletop Simulator.
-- Select a pile, then click Add. Three cards sit on the top of the tile.
-- Arrows, Add, and the bar along the bottom move through the lineup.
-- Hover the tile and tap rotate to slide the row sideways.

local COLORS = {"White","Brown","Red","Orange","Yellow","Green","Teal","Blue","Purple","Pink","Black"}
local VISIBLE = 3
local owner = ""
local order = {}
local known = {}
local released = {}
local scroll = 0
local busy = false
local pipCount = 0
local lastX, lastY, lastZ = nil, nil, nil

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
  return width, depth, size.y or 0.2
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

function cardName(guid)
  local obj = getObjectFromGUID(guid)
  if not obj then return "" end
  local name = ""
  pcall(function() name = obj.getName() or "" end)
  return name:lower()
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
  return JSON.encode({ owner = owner })
end

function onLoad(saved)
  local raw = saved
  if not raw or raw == "" then raw = self.script_state end
  if raw and raw ~= "" then
    local data = JSON.decode(raw) or {}
    if data.owner then owner = data.owner end
  end
  self.setLock(false)
  self.sticky = false
  self.setName("Token Viewer")
  self.setDescription("Select a pile, then click Add.")
  buildChrome()
end

function buildChrome()
  self.clearButtons()
  local hx, hz = localHalf()
  local buttonY = 0.18
  local zRow = hz * 0.58
  local zBar = hz * 0.88
  local ink = {0.12, 0.09, 0.18}
  local font = {0.94, 0.91, 1}
  self.createButton({
    click_function = "viewPrev", function_owner = self, label = "<",
    position = {-hx * 0.62, buttonY, zRow}, width = 240, height = 200, font_size = 110,
    color = ink, font_color = font,
  })
  self.createButton({
    click_function = "addSelected", function_owner = self, label = "Add",
    position = {0, buttonY, zRow}, width = math.floor(hx * 380), height = 200, font_size = 100,
    color = ink, font_color = font,
  })
  self.createButton({
    click_function = "viewNext", function_owner = self, label = ">",
    position = {hx * 0.62, buttonY, zRow}, width = 240, height = 200, font_size = 110,
    color = ink, font_color = font,
  })
  pipCount = math.max(1, math.min(12, maxScroll() + 1))
  local span = hx * 1.5
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
  local active = 0
  local limit = maxScroll()
  if limit > 0 and pipCount > 1 then
    active = math.floor((scroll / limit) * (pipCount - 1) + 0.5)
  end
  for i = 0, pipCount - 1 do
    local color = i == active and {0.58, 0.48, 0.82} or {0.22, 0.18, 0.32}
    pcall(function() self.editButton({ index = 3 + i, color = color }) end)
  end
end

function jumpPip(i)
  local limit = maxScroll()
  local n = math.max(1, pipCount)
  local frac = n == 1 and 0 or i / (n - 1)
  scroll = math.floor(frac * limit + 0.5)
  layout()
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

function scrollBy(step)
  local limit = maxScroll()
  scroll = math.max(0, math.min(limit, scroll + step))
  layout()
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
      buildChrome()
      layout()
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

function layout()
  local origin = self.getPosition()
  local forward, right, yaw = basis()
  local width, depth, thick = worldExtents()
  local spacing = math.max(1.2, math.min(2.05, width * 0.28))
  local lift = math.max(0.35, (thick or 0.2) * 0.5 + 0.28)
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
        local pos = vadd(origin, forward, -depth / 6)
        pos = vadd(pos, right, -span / 2 + (visual - 1) * spacing)
        pos.y = origin.y + lift
        pcall(function()
          obj.setLock(false)
          obj.use_gravity = false
          obj.setPosition(pos)
          obj.setRotation({ x = 0, y = yaw, z = 0 })
          obj.setInvisibleTo(hiddenFrom(owner))
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
  local pages = math.max(1, maxScroll() + 1)
  if pages ~= pipCount then buildChrome() else paintPips() end
  local page = scroll + 1
  pcall(function() self.setName("Token Viewer  " .. math.min(page, pages) .. "/" .. pages) end)
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
end

function onUpdate()
  local moved = false
  local p = self.getPosition()
  if not lastX or math.abs(p.x - lastX) + math.abs(p.y - lastY) + math.abs(p.z - lastZ) > 0.08 then
    lastX, lastY, lastZ = p.x, p.y, p.z
    moved = true
  end
  if #order == 0 then return end
  for i = #order, 1, -1 do
    local guid = order[i]
    local obj = getObjectFromGUID(guid)
    if not obj then
      table.remove(order, i)
      known[guid] = nil
    elseif heldBy(obj) then
      releaseHeld(guid, i)
    end
  end
  if moved then layout() end
end

function viewPrev(_, color)
  claim(color)
  scrollBy(-1)
end

function viewNext(_, color)
  claim(color)
  scrollBy(1)
end
