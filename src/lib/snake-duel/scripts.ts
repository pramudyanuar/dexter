// Keep admission, capacity, and frame updates atomic across Vercel instances.
export const MAX_ACTIVE_ROUNDS = 2;
export const MATCHED_TTL_SECONDS = 90;
export const INPUT_TTL_MS = 3000;
export const ADMISSION_TTL_SECONDS = 60;

export const CREATE_ROOM = `
local prior = redis.call('GET', KEYS[3])
if prior then return prior end
if not redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2]) then return '' end
redis.call('SET', KEYS[3], ARGV[3], 'EX', ARGV[2])
if ARGV[4] ~= '' then redis.call('ZADD', KEYS[2], ARGV[4], ARGV[3]) end
return ARGV[3]
`;

export const COMMIT_ROOM = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
local change = cjson.decode(ARGV[3])
if change.reserve then
  redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', change.now)
  if redis.call('ZCARD', KEYS[2]) >= ${MAX_ACTIVE_ROUNDS} then return -2 end
  local used = tonumber(redis.call('GET', KEYS[4]) or '0')
  if used >= change.monthlyRounds then return -3 end
  redis.call('ZADD', KEYS[2], change.deadline, change.reserve)
  if redis.call('INCR', KEYS[4]) == 1 then redis.call('EXPIRE', KEYS[4], 3024000) end
end
if change.release then redis.call('ZREM', KEYS[2], change.release) end
if change.lobby == 'open' then
  redis.call('ZADD', KEYS[3], change.indexExpiry, change.code)
elseif change.lobby == 'hide' then
  redis.call('ZREM', KEYS[3], change.code)
end
redis.call('SET', KEYS[1], ARGV[2], 'EX', change.roomTtl)
return 1
`;

export const ATTACH = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local room = cjson.decode(raw)
local seat = room.players[tonumber(ARGV[1]) + 1]
if type(seat) ~= 'table' or seat.tokenHash ~= ARGV[2] then return 0 end
local now = tonumber(ARGV[3])
local presence = {id = ARGV[2], seenAt = now}
local prior = redis.call('GET', KEYS[2])
if prior then
  local previous = cjson.decode(prior)
  local lostAt = previous.closedAt or (previous.seenAt + tonumber(ARGV[5]))
  if previous.id == presence.id and lostAt > now then return 2 end
  if type(room.round) == 'table' and room.round.phase ~= 'over' and
    (previous.expiredRound == room.round.id or now - lostAt >= tonumber(ARGV[6])) then
    presence.expiredRound = room.round.id
  end
end
redis.call('SET', KEYS[2], cjson.encode(presence), 'EX', ARGV[4])
return 1
`;

export const UPDATE_PRESENCE = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local presence = cjson.decode(raw)
if presence.id ~= ARGV[1] or presence.closedAt then return 0 end
if ARGV[4] == 'close' then
  presence.closedAt = tonumber(ARGV[2])
else
  presence.seenAt = math.max(presence.seenAt, tonumber(ARGV[2]))
end
redis.call('SET', KEYS[1], cjson.encode(presence), 'EX', ARGV[3])
return 1
`;

export const UPDATE_INPUT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local presence = cjson.decode(raw)
if presence.id ~= ARGV[1] or presence.closedAt then return 0 end
local previous = redis.call('GET', KEYS[2])
if previous then
  local input = cjson.decode(previous)
  if input.player == ARGV[1] and input.roundId == ARGV[3] and input.seq >= tonumber(ARGV[4]) then
    return 0
  end
end
redis.call('SET', KEYS[2], ARGV[2], 'PX', ${INPUT_TTL_MS})
return 1
`;

export const QUEUE_OR_MATCH = `
local now = tonumber(ARGV[1])
local existing = redis.call('GET', KEYS[2])
if existing then return existing end
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
local ids = redis.call('ZRANGE', KEYS[1], 0, 0)
local peer = ids[1]
if peer then
  local peerKey = ARGV[6] .. peer
  local queued = redis.call('GET', peerKey)
  if queued then
    local member = cjson.decode(queued)
    if member.status == 'queued' and member.expiresAt > now then
      local proposal = cjson.decode(ARGV[5])
      proposal.room.players[1].name = member.name
      if not redis.call('SET', KEYS[3], cjson.encode(proposal.room), 'NX', 'EX', ARGV[7]) then
        return ''
      end
      local first = cjson.encode({status = 'matched', session = proposal.sessions[1]})
      local second = cjson.encode({status = 'matched', session = proposal.sessions[2]})
      redis.call('ZREM', KEYS[1], peer)
      redis.call('SET', peerKey, first, 'EX', ${MATCHED_TTL_SECONDS})
      redis.call('SET', KEYS[2], second, 'EX', ${MATCHED_TTL_SECONDS})
      return second
    end
  end
  redis.call('ZREM', KEYS[1], peer)
end
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
redis.call('SET', KEYS[2], ARGV[4], 'PX', tonumber(ARGV[2]) - now)
return ARGV[4]
`;

export const CANCEL_TICKET = `
local raw = redis.call('GET', KEYS[2])
if raw and cjson.decode(raw).status == 'matched' then return raw end
redis.call('ZREM', KEYS[1], ARGV[1])
redis.call('DEL', KEYS[2])
return ''
`;

export const LIMIT_ADMISSION = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ${ADMISSION_TTL_SECONDS}) end
return count
`;
