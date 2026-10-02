-- DeckApp selector for Tabletop Simulator.
-- Spawn any object, paste this script, and click the button.
-- Chat still works: !deckapp <public deck url or id>

local API = "https://deckapp-bwio.onrender.com/api/tts/"
local BACK = "https://backs.scryfall.io/large/0/0/0aeebaf5-8c7d-4636-9e82-8c27447861f7.jpg"
local decks = {}

function onLoad()
  self.createButton({
    click_function = "openGui",
    function_owner = self,
    label = "DeckApp",
    position = {0, 0.35, 0},
    rotation = {0, 180, 0},
    width = 1400,
    height = 360,
    font_size = 150,
    color = {0.16, 0.12, 0.24},
    font_color = {0.93, 0.9, 1},
  })
end

function xmlEscape(s)
  return (tostring(s or ""):gsub("&", "&"):gsub("<", "<"):gsub(">", ">"))
end

function openGui()
  broadcastToAll("Loading public decks…", {0.8, 0.8, 1})
  WebRequest.get(API .. "decks", function(req)
    if req.is_error or req.response_code ~= 200 then
      broadcastToAll("Deck list failed. Is the deck public, and is Supabase configured on the API?", {1, 0.4, 0.4})
      return
    end
    local data = JSON.decode(req.text)
    decks = data.decks or {}
    drawGui(decks)
  end)
end

function drawGui(list)
  local rows = ""
  for _, deck in ipairs(list) do
    rows = rows .. string.format(
      '<Button id="deck_%s" onClick="pickDeck" preferredHeight="56" color="#2a2140" textColor="#f4f0ff">%s</Button>',
      deck.id,
      xmlEscape((deck.name or "Deck") .. "  ·  " .. (deck.format or ""))
    )
  end
  if rows == "" then rows = '<Text color="#f4f0ff">No public decks.</Text>' end
  self.UI.setXml(string.format([[
    <Panel position="0 180 -40" width="520" height="640" color="#140f1e" rectAlignment="UpperCenter" padding="16">
      <Text fontSize="22" color="#f4f0ff" preferredHeight="36">Public decks</Text>
      <InputField id="filter" onEndEdit="filterDecks" placeholder="Filter" preferredHeight="40" />
      <VerticalScrollView preferredHeight="500">
        <VerticalLayout spacing="6" childAlignment="UpperCenter">%s</VerticalLayout>
      </VerticalScrollView>
      <Button onClick="closeGui" preferredHeight="40" color="#3a2a4e">Close</Button>
    </Panel>
  ]], rows))
end

function filterDecks(_, value)
  local q = string.lower(value or "")
  local nextList = {}
  for _, deck in ipairs(decks) do
    if q == "" or string.find(string.lower(deck.name or ""), q, 1, true) then
      table.insert(nextList, deck)
    end
  end
  drawGui(nextList)
end

function pickDeck(_, _, id)
  local deckId = id:gsub("^deck_", "")
  closeGui()
  loadDeck(deckId, self.getPosition())
end

function closeGui()
  self.UI.setXml("")
end

function onChat(message)
  local raw = message:match("^!deckapp%s+(.+)$")
  if not raw then return end
  local id = raw:match("([0-9a-fA-F%-]+)%s*$")
  if not id then return end
  loadDeck(id, nil)
  return false
end

function loadDeck(id, pos)
  broadcastToAll("Loading deck…", {0.8, 0.8, 1})
  WebRequest.get(API .. "deck/" .. id, function(req)
    if req.is_error or req.response_code ~= 200 then
      broadcastToAll("Deck load failed: " .. (req.error or req.text), {1, 0.4, 0.4})
      return
    end
    spawnDeck(JSON.decode(req.text), pos)
  end)
end

function spawnDeck(data, pos)
  pos = pos or {0, 3, 0}
  local pending = {}
  for _, card in ipairs(data.cards or {}) do
    if card.board ~= "maybe" then
      for _ = 1, (card.quantity or 1) do table.insert(pending, card) end
    end
  end
  if #pending == 0 then
    broadcastToAll("Deck has no cards.", {1, 0.6, 0.4})
    return
  end
  local spawned = {}
  local left = #pending
  for i, card in ipairs(pending) do
    spawnObject({
      type = "Card",
      position = {pos.x + 2, pos.y + 1 + i * 0.02, pos.z},
      callback_function = function(obj)
        obj.setCustomObject({ face = card.face, back = BACK })
        obj.setName(card.name)
        obj.reload()
        Wait.time(function()
          table.insert(spawned, obj)
          left = left - 1
          if left == 0 then
            local deck = spawned[1]
            for n = 2, #spawned do deck = deck.putObject(spawned[n]) or deck end
            deck.setName(data.name or "DeckApp deck")
            broadcastToAll("Spawned " .. (data.name or "deck") .. " with owner art", {0.6, 1, 0.6})
          end
        end, 0.5)
      end
    })
  end
end
