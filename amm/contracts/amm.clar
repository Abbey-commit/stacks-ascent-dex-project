;; traits
(use-trait ft-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)


;; constants
;;
(define-constant MINIMUM_LIQUIDITY u1000) ;; minimum liiquidity that must exist in a pool
(define-constant THIS_CONTRACT (as-contract tx-sender)) ;; this contract
(define-constant FEES_DEMON u10000) ;; fees denominator

;; errors
(define-constant ERR_POOLALREADY_EXISTS (err u200)) ;; pool already exists
(define-constant ERR_INCORRECT_TOKEN_ORDERING (err u201)) ;; incorrect token ordering (Invalid sorting)
(define-constant ERR_INSUFFICIENT_LIQUIDITY_MINTED (err u202)) ;; insufficient liquidity amounts being add
(define-constant ERR_INSUFFICIENT_LIQUIDITY_OWNED (err u203)) ;; not enough amount liquidity owned to withdraw the requested amount
(define-constant ERR_INSUFFICIENT_LIQUIDITY_BURNED (err u204)) ;; insufficient liquidity amount being removed
(define-constant ERR_INSUFFICIENT_INPUT_AMOUNT (err u205)) ;; insufficient input token amount for swap
(define-constant ERR_INSUFFICIENT_LIQUIDITY_FOR_SWAP (err u206)) ;; insufficient liquidity in the pool for swap
(define-constant ERR_INSUFFICIENT_1_AMOUNT (err u207)) ;; insufficient amount of token 1 being sent to the pool
(define-constant ERR_INSUFFICIENT_0_AMOUNT (err u208)) ;; insufficient amount of token  0 for swap

;; mappings
(define-map pools
    (buff 20) ;; Pool ID (hash of token0, token1)
    {
        token-0: principal,
        token-1: principal,
        fee: uint,

        liquidity: uint,
        balance-0: uint,
        balance-1: uint
    }
)

(define-map positions
    {
        pool-id: (buff 20),
        owner: principal
    }
    {
        liquidity: uint
    }
)

;; Compute the hash of (token0 + token1 + fee) to use a pool ID
(define-read-only (get-pool-id (pool-info {token-0: <ft-trait>, token-1: <ft-trait>, fee: uint}))
    (let 
        (
            (buff (unwrap-panic (to-consensus-buff? pool-info)))
            (pool-id (hash160 buff))
        )
        
        pool-id
    )
)

;; private functions
;; Ensure that the token-0 principal is "less than" token-1 principal
(define-private (correct-token-ordering (token-0 principal) (token-1 principal))
    (let 
        (
            (token-0-buff (unwrap-panic (to-consensus-buff? token-0)))
            (token-1-buff (unwrap-panic (to-consensus-buff? token-1)))
        )
        
        (asserts! (< token-0-buff token-1-buff) ERR_INCORRECT_TOKEN_ORDERING)
        (ok true)
    )
)

;; get-position-liquidity
;; Given a Pool ID and a user address, returns how much liquidity the user has in the pool
(define-read-only (get-position-liquidity (pool-id (buff 20)) (owner principal))
    (let
        (
            ;; look up the position in the `positions` map
            (position (map-get? positions { pool-id: pool-id, owner: owner}))
            ;; if position exists, return the liquidity otherwise return 0
            (existing-owner-liquidity (if (is-some position) (unwrap-panic position) {liquidity: u0}))
        )

        (ok (get liquidity existing-owner-liquidity))    
    )
)

;; ----------------------------------------------------------------
;; HELPER FUNCTION: min
;; ----------------------------------------------------------------
;; Returns the smaller of two unsigned integers.
(define-private (min (a uint) (b uint))
    (if (< a b) a b)
)
  
;; get-amounts
;; Given the desired amount of token-0 and token-1, the minimum of token-0 and token-1 and current 
;; reserves of token-0 and token-1, returns the amounts of token-0 and token-1 that should be provided
;; to the pool to meet all constraints
;; Corrected get-amounts (Ratio calculation is simplified for a standard pool)
(define-private (get-amounts (amount-0-desired uint) (amount-1-desired uint) (amount-0-min uint)
    (amount-1-min uint) (balance-0 uint) (balance-1 uint))
    (let
        (
            ;; calculate ideal amount of token-1 required if amount-0-desired is used fully
            (amount-1-ideal-given-0 (/ (* amount-0-desired balance-1) balance-0))
            
            ;; calculate ideal amount of token-0 required if amount-1-desired is used fully
            (amount-0-ideal-given-1 (/ (* amount-1-desired balance-0) balance-1))
        )
        
        (if 
            ;; Condition: Is Token-0 the limiting factor? (i.e., we need less Token-1 than desired)
            (<= amount-1-ideal-given-0 amount-1-desired)
            (begin
                ;; If so, check if the calculated Token-1 amount meets the minimum required
                (asserts! (>= amount-1-ideal-given-0 amount-1-min) ERR_INSUFFICIENT_1_AMOUNT)
                ;; Return the pair: (desired-0, ideal-1)
                (ok {amount-0: amount-0-desired, amount-1: amount-1-ideal-given-0})
            )
            ;; Else: Token-1 is the limiting factor
            (begin
                ;; Check if the calculated Token-0 amount meets the minimum required
                (asserts! (>= amount-0-ideal-given-1 amount-0-min) ERR_INSUFFICIENT_0_AMOUNT)
                ;; Return the pair: (ideal-0, desired-1)
                (ok {amount-0: amount-0-ideal-given-1, amount-1: amount-1-desired})
            )
        )
    )
)

;; add-liquidity
;; Add liquidity to a given pool
;; Ensure the pool exists, calculate what token amounts are possible to add as liquidity, handle the case where this 
;; is the is the first liquidity being added to transfer token to the pool, and
;; Corrected add-liquidity
(define-public (add-liquidity (token-0 <ft-trait>) (token-1 <ft-trait>) (fee uint)
(amount-0-desired uint) (amount-1-desired uint) (amount-0-min uint) (amount-1-min uint))
    (let
        (
            (pool-info {
                token-0: token-0,
                token-1: token-1,
                fee: fee
            })            
            (pool-id (get-pool-id pool-info))
            (pool-data (unwrap! (map-get? pools pool-id) (err u0))) ;; Assuming pool exist here
            (sender tx-sender)

            (pool-liquidity (get liquidity pool-data))
            (balance-0 (get balance-0 pool-data))
            (balance-1 (get balance-1 pool-data))
            ;; fetch the current liquidity of the user in the pool (default 0 if no existing position)
            (user-liquidity (unwrap-panic (get-position-liquidity pool-id sender)))

            ;; is this the first time liquidity is being added to the pool?
            (is-initial-liquidity (is-eq pool-liquidity u0))

            (amounts 
                (if 
                    is-initial-liquidity
                    {amount-0: amount-0-desired, amount-1: amount-1-desired}
                    (unwrap! (get-amounts amount-0-desired amount-1-desired amount-0-min amount-1-min balance-0 balance-1) (err u0))
                )
            )
            (amount-0 (get amount-0 amounts))
            (amount-1 (get amount-1 amounts))

            ;; Calculate new liquidity (L)
            (new-liquidity
                (if 
                    is-initial-liquidity
                    (- (sqrti (* amount-0 amount-1)) MINIMUM_LIQUIDITY)
                    (min (/ (* amount-0 pool-liquidity) balance-0) (/ (* amount-1 pool-liquidity) balance-1))
                )
            )

            (new-pool-liquidity
                (if 
                    is-initial-liquidity
                    (+ new-liquidity MINIMUM_LIQUIDITY)
                    new-liquidity
                )
            )
        )
        (asserts! (> new-liquidity u0) ERR_INSUFFICIENT_LIQUIDITY_MINTED)

        (try! (contract-call? token-0 transfer amount-0 sender THIS_CONTRACT none))
        (try! (contract-call? token-1 transfer amount-1 sender THIS_CONTRACT none))

        (map-set positions
            {pool-id: pool-id, owner: sender}
            {liquidity: (+ user-liquidity new-liquidity)}
        )

        (map-set pools pool-id (merge pool-data {
            liquidity: (+ pool-liquidity new-pool-liquidity),
            balance-0: (+ balance-0 amount-0),
            balance-1: (+ balance-1 amount-1)
        }))

        (ok true)
    )
)


;; remove-liquidity
;; Removes liquidity from a given pool
;; Ensure the pool exists, ensures the user owns enough liquidity as they want  to
;; remove, calculate amount of tokens to give back to them
;; Transfer tokens from pool to user, and update mappings as needed
(define-public (remove-liquidity (token-0 <ft-trait>) (token-1 <ft-trait>) (fee uint) (liquidity uint))
    (let
        (
            ;; compute the pool id and fetch the current state of the pool from the mappiing
            (pool-info {
                token-0: token-0,
                token-1: token-1,
                fee: fee
            })
            (pool-id (get-pool-id pool-info))
            (pool-data (unwrap! (map-get? pools pool-id) (err u0)))
            (sender tx-sender)

            (pool-liquidity (get liquidity pool-data))
            (balance-0 (get balance-0 pool-data))
            (balance-1 (get balance-1 pool-data))

            ;; fetch the user's position
            (user-liquidity (unwrap! (get-position-liquidity pool-id sender) (err u0)))

            ;; calculate how much amount-0 and amount-1 the user should receive as % of 
            ;; how much they are withdrawing compared to the total pool liquidity
            (amount-0 (/ (* liquidity balance-0) pool-liquidity))
            (amount-1 (/ (* liquidity balance-1) pool-liquidity))

        )
        ;; make sure user owns enough liquidity to withdraw
        (asserts! (>= user-liquidity liquidity) ERR_INSUFFICIENT_LIQUIDITY_OWNED)
        ;; make sure user is getting at least some amount of tokens back
        (asserts! (> amount-0 u0) ERR_INSUFFICIENT_LIQUIDITY_BURNED)
        (asserts! (> amount-1 u0) ERR_INSUFFICIENT_LIQUIDITY_BURNED)

        ;; transfer tokens from pool to user
        (try! (as-contract (contract-call? token-0 transfer amount-0 THIS_CONTRACT sender none)))
        (try! (as-contract (contract-call? token-1 transfer amount-1 THIS_CONTRACT sender none)))

        ;; update the `positions` map with the new liquidity of the user (pre existing liquidity - new liquidity)
        (map-set positions
            {pool-id: pool-id, owner: sender}
            {liquidity: (- user-liquidity liquidity)}
        )
        
        ;; update the `pools` map with the new pool liquidity, balance-0, and balance-1
        (map-set pools pool-id (merge pool-data {
            liquidity: (- pool-liquidity liquidity),
            balance-0: (- balance-0 amount-0),
            balance-1: (- balance-1 amount-1)
        }))
        (print { action: "remove-liquidity", pool-id: pool-id, amount-0: amount-0, amount-1: amount-1, liquidity: liquidity }) 
        (ok true)
    )
)


;; swap 
;; Swaps two tokens in a given pool
;; Ensure the pool exists, calculate the amount of the tokens to give back to the  user, 
;; handle the case where the user is swapping for token-0 or token-1
;; Transfer input token from user to pool, transfer output token from pool to user and update mapping as needed
(define-public (swap (token-0 <ft-trait>) (token-1 <ft-trait>) (fee uint) (input-amount uint) (zero-for-one bool))
    (let
        (
            ;; compute the pool id and fetch the current state of the pool from the mapping
            (pool-info {
                token-0: token-0,
                token-1: token-1,
                fee: fee
            })
            (pool-id (get-pool-id pool-info))
            (pool-data (unwrap! (map-get? pools pool-id) (err u0)))
            (sender tx-sender)

            (pool-liquidity (get liquidity pool-data))
            (balance-0 (get balance-0 pool-data))
            (balance-1 (get balance-1 pool-data))

            ;; xy = k
            (k (* balance-0 balance-1))

            ;; apply the fee to the input amount (input-amount * (1 - fee/FEES_DEMON))
            (input-amount-after-fee (- input-amount (/ (* input-amount fee) FEES_DEMON)))

            ;; keep track of which token is the input and which is the output
            ;; based on the value of zero-for-one
            (input-token (if zero-for-one token-0 token-1))
            (output-token (if zero-for-one token-1 token-0))

            ;; keep track of the input and output balances
            (input-balance (if zero-for-one balance-0 balance-1))
            (output-balance (if zero-for-one balance-1 balance-0))

            ;; compute the output amount by solving (x + dx) * (y - dy) = k
            ;; dy = y - (k / (x + dx))
            (output-amount (- output-balance (/ k (+ input-balance input-amount-after-fee))))

            ;; compute the new balances of the pool after the swap
            (balance-0-post-swap (if zero-for-one (+ balance-0 input-amount) (- balance-0 output-amount)))
            (balance-1-post-swap (if zero-for-one (- balance-1 output-amount) (+ balance-1 input-amount)))
        )

        ;; make sure user is swapping >0 tokens
        (asserts! (> input-amount u0) ERR_INSUFFICIENT_INPUT_AMOUNT)
        ;; make sure user is getting back >0 tokens
        (asserts! (> output-amount-sub-fees u0) ERR_INSUFFICIENT_LIQUIDITY_FORS_WAP)
        ;; make sure we can afford to do this swap (have enough output tokens back to user)
        (asserts! (< output-amount-sub-fees output-balance) ERR_INSUFFICIENT_LIQUIDITY_FORS_WAP)

        ;; transfer input token from user to pool
        (try! (contract-call? input-token transfer input-amount sender THIS_CONTRACT none))
        ;; transfer output token from pool to user
        (try! (as-contract (contract-call? output-token transfer output-amount-sub-fees THIS_CONTRACT sender none)))

        ;; update pool balances (x and y)
        (map-set pools pool-id (merge pool-data {
            balance-0: balance-0-post-swap,
            balance-1: balance-1-post-swap
        }))

        (print { action: "swap", pool-id: pool-id, input-amount: input-amount })
        (ok true)
    )
)

;; get-pool-data
;; Given a pool ID, returns the current state of the pool from the mapping
(define-read-only (get-pool-data (pool-id (buff 20)))
    (let
        (
            (pool-data (map-get? pools pool-id))
        )
        (ok pool-data)
    )
)

