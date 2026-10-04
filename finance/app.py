import os

from cs50 import SQL
from flask import Flask, flash, redirect, render_template, request, session
from flask_session import Session
from werkzeug.security import check_password_hash, generate_password_hash

from helpers import apology, login_required, lookup, usd

# Configure application
app = Flask(__name__)

# Custom filter
app.jinja_env.filters["usd"] = usd

# Configure session to use filesystem (instead of signed cookies)
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"
Session(app)

# Configure CS50 Library to use SQLite database
db = SQL("sqlite:///finance.db")


@app.after_request
def after_request(response):
    """Ensure responses aren't cached"""
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Expires"] = 0
    response.headers["Pragma"] = "no-cache"
    return response


@app.route("/")
@login_required
def index():
    """Show portfolio of stocks"""

    user_id = session["user_id"]

    holdings = db.execute(
        """
        SELECT symbol, SUM(shares) as total_shares
        FROM transactions
        WHERE user_id = ?
        GROUP BY symbol
        HAVING total_shares > 0
        """,
        user_id,
    )

    portfolio = []
    total_stock_value = 0

    for holding in holdings:
        quote = lookup(holding["symbol"])
        if quote:
            value = quote["price"] * holding["total_shares"]
            total_stock_value += value
            portfolio.append(
                {
                    "symbol": holding["symbol"],
                    "name": quote["name"],
                    "shares": holding["total_shares"],
                    "price": quote["price"],
                    "value": value,
                }
            )

    user = db.execute("SELECT cash FROM users WHERE id = ?", user_id)[0]
    cash = user["cash"]
    grand_total = cash + total_stock_value

    return render_template(
        "index.html",
        portfolio=portfolio,
        cash=cash,
        grand_total=grand_total,
    )


@app.route("/buy", methods=["GET", "POST"])
@login_required
def buy():
    """Buy shares of stock"""

    if request.method == "POST":
        symbol = request.form.get("symbol", "").strip().upper()
        shares_str = request.form.get("shares", "")

        if not symbol:
            return apology("must provide symbol", 400)

        quote = lookup(symbol)
        if not quote:
            return apology("invalid symbol", 400)

        try:
            shares = int(shares_str)
            if shares <= 0:
                raise ValueError
        except ValueError:
            return apology("shares must be a positive integer", 400)

        user_id = session["user_id"]
        user = db.execute("SELECT cash FROM users WHERE id = ?", user_id)[0]
        cash = user["cash"]
        total_cost = quote["price"] * shares

        if cash < total_cost:
            return apology("can't afford", 400)

        db.execute(
            "INSERT INTO transactions (user_id, symbol, shares, price) VALUES (?, ?, ?, ?)",
            user_id,
            symbol,
            shares,
            quote["price"],
        )

        db.execute(
            "UPDATE users SET cash = cash - ? WHERE id = ?",
            total_cost,
            user_id,
        )

        flash(f"Bought {shares} share(s) of {symbol}!")
        return redirect("/")

    return render_template("buy.html")


@app.route("/history")
@login_required
def history():
    """Show history of transactions"""

    user_id = session["user_id"]
    transactions = db.execute(
        """
        SELECT symbol, shares, price, transacted_at
        FROM transactions
        WHERE user_id = ?
        ORDER BY transacted_at DESC
        """,
        user_id,
    )
    return render_template("history.html", transactions=transactions)



@app.route("/login", methods=["GET", "POST"])
def login():
    """Log user in"""

    # Forget any user_id
    session.clear()

    # User reached route via POST (as by submitting a form via POST)
    if request.method == "POST":
        # Ensure username was submitted
        if not request.form.get("username"):
            return apology("must provide username", 403)

        # Ensure password was submitted
        elif not request.form.get("password"):
            return apology("must provide password", 403)

        # Query database for username
        rows = db.execute(
            "SELECT * FROM users WHERE username = ?", request.form.get("username")
        )

        # Ensure username exists and password is correct
        if len(rows) != 1 or not check_password_hash(
            rows[0]["hash"], request.form.get("password")
        ):
            return apology("invalid username and/or password", 403)

        # Remember which user has logged in
        session["user_id"] = rows[0]["id"]

        # Redirect user to home page
        return redirect("/")

    # User reached route via GET (as by clicking a link or via redirect)
    else:
        return render_template("login.html")


@app.route("/logout")
def logout():
    """Log user out"""

    # Forget any user_id
    session.clear()

    # Redirect user to login form
    return redirect("/")


@app.route("/quote", methods=["GET", "POST"])
@login_required
def quote():
    """Get stock quote."""
    if request.method == "POST":
        symbol = request.form.get("symbol", "").strip()
        if not symbol:
            return apology("must provide symbol", 400)

        quote = lookup(symbol)
        if not quote:
            return apology("invalid symbol", 400)

        return render_template("quoted.html", quote=quote)

    return render_template("quote.html")


@app.route("/register", methods=["GET", "POST"])
def register():
    """Register user"""
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        confirmation = request.form.get("confirmation")

        # Validation
        if not username:
            return apology("must provide username", 400)
        elif not password:
            return apology("must provide password", 400)
        elif password != confirmation:
            return apology("passwords do not match", 400)

        # Hash and Insert
        hash = generate_password_hash(password)
        try:
            new_user_id = db.execute("INSERT INTO users (username, hash) VALUES (?, ?)", username, hash)
        except ValueError:
            return apology("username already exists", 400)

        # Log user in automatically
        session["user_id"] = new_user_id
        return redirect("/")

    else:
        return render_template("register.html")

@app.route("/sell", methods=["GET", "POST"])
@login_required
def sell():
    """Sell shares of stock"""

    user_id = session["user_id"]

    holdings = db.execute(
        """
        SELECT symbol, SUM(shares) as total_shares
        FROM transactions
        WHERE user_id = ?
        GROUP BY symbol
        HAVING total_shares > 0
        """,
        user_id,
    )

    if request.method == "POST":
        symbol = request.form.get("symbol", "").strip().upper()
        shares_str = request.form.get("shares", "")

        if not symbol:
            return apology("must select a stock", 400)

        owned = next((h for h in holdings if h["symbol"] == symbol), None)
        if not owned:
            return apology("you don't own that stock", 400)

        try:
            shares = int(shares_str)
            if shares <= 0:
                raise ValueError
        except ValueError:
            return apology("shares must be a positive integer", 400)

        if shares > owned["total_shares"]:
            return apology("too many shares", 400)

        quote = lookup(symbol)
        if not quote:
            return apology("invalid symbol", 400)

        proceeds = quote["price"] * shares

        db.execute(
            "INSERT INTO transactions (user_id, symbol, shares, price) VALUES (?, ?, ?, ?)",
            user_id,
            symbol,
            -shares,
            quote["price"],
        )

        db.execute(
            "UPDATE users SET cash = cash + ? WHERE id = ?",
            proceeds,
            user_id,
        )

        flash(f"Sold {shares} share(s) of {symbol}!")
        return redirect("/")

    return render_template("sell.html", holdings=holdings)


@app.route("/password", methods=["GET", "POST"])
@login_required
def change_password():
    if request.method == "POST":
        current = request.form.get("current_password", "")
        new_password = request.form.get("new_password", "")
        confirmation = request.form.get("confirmation", "")

        if not current or not new_password or not confirmation:
            return apology("must fill all fields", 400)

        user = db.execute("SELECT * FROM users WHERE id = ?", session["user_id"])[0]
        if not check_password_hash(user["hash"], current):
            return apology("current password is incorrect", 403)

        if new_password != confirmation:
            return apology("new passwords do not match", 400)

        db.execute(
            "UPDATE users SET hash = ? WHERE id = ?",
            generate_password_hash(new_password),
            session["user_id"],
        )

        flash("Password changed successfully!")
        return redirect("/")

    return render_template("password.html")


@app.route("/addcash", methods=["GET", "POST"])
@login_required
def add_cash():
    if request.method == "POST":
        try:
            amount = float(request.form.get("amount", 0))
            if amount <= 0:
                raise ValueError
        except ValueError:
            return apology("must provide a positive amount", 400)

        db.execute(
            "UPDATE users SET cash = cash + ? WHERE id = ?",
            amount,
            session["user_id"],
        )

        flash(f"Added {usd(amount)} to your account!")
        return redirect("/")

    return render_template("addcash.html")
